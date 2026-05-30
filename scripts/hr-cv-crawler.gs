/**
 * HR CV Auto-Crawler & Analyzer
 *
 * Features:
 * - Crawls Gmail for CV/resume emails
 * - Analyzes CV content using Gemini AI
 * - Categorizes by applied position with match scoring
 * - Saves to Google Sheet with full analysis
 * - Downloads CV attachments to Google Drive (organized by position & score)
 * - Daily trigger at 2am WIB (19:00 UTC)
 * - First run: last 7 days; subsequent: incremental
 */

// ============================================================
// CONFIGURATION — Edit these before running
// ============================================================
const CONFIG = {
  SPREADSHEET_ID: '1ZO8C1xQq8e9Ip1b5NydbEfUS9G74A03mTqXlCtE-N9M',
  DRIVE_FOLDER_ID: '1Ify7yfPGTFi-0z4MHPIO8oeBzZLlnhcK',

  // Gmail search query — adjust to match your HR inbox labels/filters
  GMAIL_SEARCH_BASE: 'has:attachment (subject:CV OR subject:Resume OR subject:"job application" OR subject:"lamaran" OR subject:"melamar")',

  // Sheet tab names
  SHEET_CANDIDATES: 'Candidates',
  SHEET_SUMMARY:    'Summary',
  SHEET_LOG:        'Log',

  // Score thresholds for Drive folder categorization
  SCORE_HIGH:   80,   // 80–100 → High Match
  SCORE_MEDIUM: 60,   // 60–79  → Medium Match
                      // <60    → Low Match / Review

  // Known open positions (used to help AI matching — add yours here)
  OPEN_POSITIONS: [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Data Analyst',
    'Product Manager',
    'UI/UX Designer',
    'HR Officer',
    'Finance Officer',
    'Marketing Specialist',
    'Operations Manager',
    'Quality Assurance',
    'Business Development',
  ],

  // Property key for storing last-crawl timestamp
  PROP_LAST_CRAWL: 'LAST_CRAWL_TIMESTAMP',
};

// ============================================================
// MAIN ENTRY POINTS
// ============================================================

/** Called manually or on first run — crawls last 7 days */
function runInitialCrawl() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  crawlEmails(sevenDaysAgo);
}

/** Called by daily trigger — crawls since last run */
function runDailyCrawl() {
  const props = PropertiesService.getScriptProperties();
  const lastCrawlTs = props.getProperty(CONFIG.PROP_LAST_CRAWL);
  const since = lastCrawlTs ? new Date(parseInt(lastCrawlTs)) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  crawlEmails(since);
}

// ============================================================
// TRIGGER SETUP — Run setupTrigger() once to install daily job
// ============================================================

function setupTrigger() {
  // Remove existing triggers for this function first
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDailyCrawl') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 2am WIB = 19:00 UTC (WIB = UTC+7)
  ScriptApp.newTrigger('runDailyCrawl')
    .timeBased()
    .everyDays(1)
    .atHour(19)          // 19:00 UTC = 02:00 WIB
    .nearMinute(0)
    .inTimezone('Asia/Jakarta')
    .create();

  log('INFO', 'Daily trigger set for 02:00 WIB (Asia/Jakarta)');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDailyCrawl') {
      ScriptApp.deleteTrigger(t);
    }
  });
  log('INFO', 'Daily trigger removed');
}

// ============================================================
// CORE CRAWL LOGIC
// ============================================================

function crawlEmails(since) {
  initSheets();

  const startTime = new Date();
  const sinceStr  = Utilities.formatDate(since, 'UTC', 'yyyy/MM/dd');
  const query     = `${CONFIG.GMAIL_SEARCH_BASE} after:${sinceStr}`;

  log('INFO', `Starting crawl. Query: ${query}`);

  const threads = GmailApp.search(query, 0, 500);
  log('INFO', `Found ${threads.length} threads`);

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;

  const sheet      = getSheet(CONFIG.SHEET_CANDIDATES);
  const existingIds = getExistingMessageIds(sheet);

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      const msgId = message.getId();
      if (existingIds.has(msgId)) { skipped++; continue; }

      try {
        const result = processEmail(message);
        if (result) {
          appendCandidateRow(sheet, result);
          processed++;
        }
      } catch (e) {
        log('ERROR', `Message ${msgId}: ${e.message}`);
        errors++;
      }

      // Pause every 10 emails to avoid quota exhaustion
      if ((processed + errors) % 10 === 0) Utilities.sleep(1000);
    }
  }

  // Update last-crawl timestamp
  PropertiesService.getScriptProperties().setProperty(
    CONFIG.PROP_LAST_CRAWL, startTime.getTime().toString()
  );

  refreshSummary();

  const summary = `Crawl complete. Processed: ${processed}, Skipped (dup): ${skipped}, Errors: ${errors}`;
  log('INFO', summary);
}

// ============================================================
// EMAIL PROCESSING
// ============================================================

function processEmail(message) {
  const subject  = message.getSubject();
  const from     = message.getFrom();
  const date     = message.getDate();
  const body     = message.getPlainBody().substring(0, 3000); // cap for AI

  const attachments = message.getAttachments();
  const cvAttachments = attachments.filter(a => isCVFile(a.getName()));

  // Extract candidate name & email from From header
  const { name: senderName, email: senderEmail } = parseFromHeader(from);

  // Extract CV text for AI analysis (first CV attachment only)
  let cvText = '';
  let cvFileName = '';
  let cvFile = null;

  if (cvAttachments.length > 0) {
    const att    = cvAttachments[0];
    cvFileName   = att.getName();
    cvFile       = att;

    try {
      cvText = extractTextFromAttachment(att);
    } catch (e) {
      log('WARN', `Could not extract text from ${cvFileName}: ${e.message}`);
    }
  }

  // Use email body if no CV text extracted
  const analysisInput = cvText || body;

  if (!analysisInput || analysisInput.trim().length < 50) {
    log('WARN', `Skipping message ${message.getId()} — insufficient content`);
    return null;
  }

  // AI analysis
  const analysis = analyzeCV(analysisInput, subject, senderName);

  // Save CV to Drive
  let driveLink = '';
  if (cvFile) {
    driveLink = saveCVToDrive(cvFile, analysis.positionApplied, analysis.matchScore, senderName, date);
  }

  return {
    messageId:       message.getId(),
    date:            date,
    senderName:      senderName,
    senderEmail:     senderEmail,
    subject:         subject,
    positionApplied: analysis.positionApplied,
    suggestedPosition: analysis.suggestedPosition,
    matchScore:      analysis.matchScore,
    matchCategory:   scoreCategory(analysis.matchScore),
    skills:          analysis.skills,
    experience:      analysis.experience,
    education:       analysis.education,
    summary:         analysis.summary,
    recommendation:  analysis.recommendation,
    cvFileName:      cvFileName,
    driveLink:       driveLink,
  };
}

// ============================================================
// AI ANALYSIS (Gemini via UrlFetchApp)
// ============================================================

function analyzeCV(cvText, emailSubject, candidateName) {
  const positionsList = CONFIG.OPEN_POSITIONS.map((p, i) => `${i + 1}. ${p}`).join('\n');

  const prompt = `You are an expert HR recruiter. Analyze this CV/resume and provide a structured JSON response.

Candidate: ${candidateName}
Email subject: ${emailSubject}

Open positions at our company:
${positionsList}

CV / Resume content:
---
${cvText.substring(0, 4000)}
---

Respond ONLY with a valid JSON object (no markdown, no extra text) with these exact keys:
{
  "positionApplied": "position name extracted from email/CV, or 'General Application' if not specified",
  "suggestedPosition": "best matching open position from the list above based on skills and experience",
  "matchScore": <integer 0-100 representing fit for suggestedPosition>,
  "skills": "comma-separated key technical and soft skills",
  "experience": "brief summary of work experience (years and domains)",
  "education": "highest degree, field, institution if available",
  "summary": "2-3 sentence professional summary of the candidate",
  "recommendation": "one of: Strong Recommend / Recommend / Consider / Not Recommended — with 1 sentence reason"
}`;

  try {
    const model    = 'gemini-1.5-flash-latest';
    const apiKey   = getGeminiApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const json = JSON.parse(response.getContentText());

    if (json.error) {
      throw new Error(`Gemini API error: ${json.error.message}`);
    }

    const rawText = json.candidates[0].content.parts[0].text.trim();

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);

  } catch (e) {
    log('ERROR', `AI analysis failed: ${e.message}`);
    // Return fallback
    return {
      positionApplied:   extractPositionFromSubject(emailSubject),
      suggestedPosition: 'Unclassified',
      matchScore:        0,
      skills:            'N/A',
      experience:        'N/A',
      education:         'N/A',
      summary:           'AI analysis unavailable — manual review required.',
      recommendation:    'Consider — manual review required',
    };
  }
}

function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set in Script Properties. Go to Project Settings → Script Properties and add it.');
  return key;
}

// ============================================================
// GOOGLE DRIVE — Save CV
// ============================================================

function saveCVToDrive(attachment, position, score, candidateName, date) {
  try {
    const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

    // Folder: Positions/<Position Name>/<Score Category>
    const posFolder   = getOrCreateSubfolder(rootFolder, sanitizeFolderName(position || 'Unclassified'));
    const scoreFolder = getOrCreateSubfolder(posFolder, scoreCategory(score));

    const dateStr = Utilities.formatDate(date, 'Asia/Jakarta', 'yyyyMMdd');
    const safeName = sanitizeFolderName(candidateName || 'Unknown');
    const ext      = attachment.getName().split('.').pop();
    const fileName = `${dateStr}_${safeName}.${ext}`;

    const blob    = attachment.copyBlob().setName(fileName);
    const newFile = scoreFolder.createFile(blob);

    return newFile.getUrl();
  } catch (e) {
    log('ERROR', `Drive save failed: ${e.message}`);
    return '';
  }
}

function getOrCreateSubfolder(parent, name) {
  const iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

function sanitizeFolderName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').substring(0, 50).trim();
}

// ============================================================
// GOOGLE SHEETS
// ============================================================

function initSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  ensureSheet(ss, CONFIG.SHEET_CANDIDATES, [
    'Message ID', 'Date', 'Sender Name', 'Email', 'Subject',
    'Position Applied', 'Suggested Position', 'Match Score', 'Match Category',
    'Skills', 'Experience', 'Education',
    'AI Summary', 'Recommendation', 'CV File', 'Drive Link',
  ]);

  ensureSheet(ss, CONFIG.SHEET_SUMMARY, [
    'Position', 'Total Applicants', 'High Match (≥80)', 'Medium Match (60–79)', 'Low Match (<60)',
    'Strong Recommend', 'Recommend', 'Consider', 'Not Recommended', 'Last Updated',
  ]);

  ensureSheet(ss, CONFIG.SHEET_LOG, ['Timestamp', 'Level', 'Message']);
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheet(name) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
}

function getExistingMessageIds(sheet) {
  const ids = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return ids;
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  data.forEach(row => { if (row[0]) ids.add(row[0]); });
  return ids;
}

function appendCandidateRow(sheet, r) {
  const row = [
    r.messageId,
    r.date,
    r.senderName,
    r.senderEmail,
    r.subject,
    r.positionApplied,
    r.suggestedPosition,
    r.matchScore,
    r.matchCategory,
    r.skills,
    r.experience,
    r.education,
    r.summary,
    r.recommendation,
    r.cvFileName,
    r.driveLink ? `=HYPERLINK("${r.driveLink}","View CV")` : '',
  ];

  sheet.appendRow(row);

  // Color-code by match category
  const lastRow = sheet.getLastRow();
  const bgColor = r.matchScore >= CONFIG.SCORE_HIGH   ? '#c8e6c9' :   // green
                  r.matchScore >= CONFIG.SCORE_MEDIUM  ? '#fff9c4' :   // yellow
                                                         '#ffcdd2';    // red
  sheet.getRange(lastRow, 1, 1, row.length).setBackground(bgColor);
}

function refreshSummary() {
  const candSheet = getSheet(CONFIG.SHEET_CANDIDATES);
  const sumSheet  = getSheet(CONFIG.SHEET_SUMMARY);

  const lastRow = candSheet.getLastRow();
  if (lastRow < 2) return;

  const data = candSheet.getRange(2, 1, lastRow - 1, 16).getValues();

  // Aggregate by position
  const positions = {};
  data.forEach(row => {
    const pos  = row[5] || 'Unclassified';   // Position Applied
    const score = Number(row[7]) || 0;
    const rec   = String(row[13] || '');

    if (!positions[pos]) {
      positions[pos] = { total: 0, high: 0, medium: 0, low: 0, strongRec: 0, rec: 0, consider: 0, notRec: 0 };
    }
    const p = positions[pos];
    p.total++;
    if (score >= CONFIG.SCORE_HIGH)        p.high++;
    else if (score >= CONFIG.SCORE_MEDIUM) p.medium++;
    else                                   p.low++;

    if (rec.startsWith('Strong Recommend'))  p.strongRec++;
    else if (rec.startsWith('Recommend'))    p.rec++;
    else if (rec.startsWith('Consider'))     p.consider++;
    else if (rec.startsWith('Not Rec'))      p.notRec++;
  });

  // Rewrite summary sheet (keep header)
  const lastSumRow = sumSheet.getLastRow();
  if (lastSumRow > 1) sumSheet.getRange(2, 1, lastSumRow - 1, 10).clearContent();

  const now = new Date();
  Object.entries(positions).forEach(([pos, p]) => {
    sumSheet.appendRow([
      pos, p.total, p.high, p.medium, p.low,
      p.strongRec, p.rec, p.consider, p.notRec,
      now,
    ]);
  });
}

// ============================================================
// UTILITIES
// ============================================================

function isCVFile(filename) {
  const lower = (filename || '').toLowerCase();
  return lower.endsWith('.pdf') ||
         lower.endsWith('.doc') ||
         lower.endsWith('.docx') ||
         lower.endsWith('.odt') ||
         lower.endsWith('.rtf');
}

function extractTextFromAttachment(attachment) {
  const name = attachment.getName().toLowerCase();

  if (name.endsWith('.pdf')) {
    // Drive PDF-to-text trick: upload temp, export as text
    const tempFolder = DriveApp.getRootFolder();
    const blob       = attachment.copyBlob();
    const tempFile   = tempFolder.createFile(blob);
    try {
      const gdocId = Drive.Files.insert(
        { title: 'temp_cv_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
        blob,
        { convert: true }
      ).id;
      const gdoc = DocumentApp.openById(gdocId);
      const text = gdoc.getBody().getText();
      DriveApp.getFileById(gdocId).setTrashed(true);
      return text;
    } finally {
      tempFile.setTrashed(true);
    }
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const blob   = attachment.copyBlob();
    const gdocId = Drive.Files.insert(
      { title: 'temp_cv_' + Date.now(), mimeType: 'application/vnd.google-apps.document' },
      blob,
      { convert: true }
    ).id;
    const gdoc = DocumentApp.openById(gdocId);
    const text = gdoc.getBody().getText();
    DriveApp.getFileById(gdocId).setTrashed(true);
    return text;
  }

  // Fallback: try reading as plain text
  return attachment.getDataAsString('UTF-8');
}

function parseFromHeader(from) {
  // Formats: "Name <email>" or "email"
  const match = from.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2].trim() };
  }
  return { name: from.trim(), email: from.trim() };
}

function extractPositionFromSubject(subject) {
  const lower = (subject || '').toLowerCase();
  for (const pos of CONFIG.OPEN_POSITIONS) {
    if (lower.includes(pos.toLowerCase())) return pos;
  }
  // Regex: "applying for X" / "application for X" / "lamaran X"
  const m = subject.match(/(?:applying for|application for|apply for|lamaran|melamar)[:\s]+(.+)/i);
  if (m) return m[1].trim().substring(0, 60);
  return 'General Application';
}

function scoreCategory(score) {
  const n = Number(score) || 0;
  if (n >= CONFIG.SCORE_HIGH)   return 'High Match';
  if (n >= CONFIG.SCORE_MEDIUM) return 'Medium Match';
  return 'Low Match';
}

function log(level, message) {
  console.log(`[${level}] ${message}`);
  try {
    const sheet = getSheet(CONFIG.SHEET_LOG);
    if (sheet) sheet.appendRow([new Date(), level, message]);
  } catch (e) {
    // Logging itself should never crash the main flow
  }
}
