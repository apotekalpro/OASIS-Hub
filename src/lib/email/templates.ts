export function taskAssignedEmail(params: {
  recipientName: string
  taskTitle: string
  assignedBy: string
  dueDate?: string
  taskUrl: string
}) {
  return {
    subject: `[OASIS Hub] New task assigned: ${params.taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>A new task has been assigned to you by <strong>${params.assignedBy}</strong>.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 8px;color:#111827">${params.taskTitle}</h3>
            ${params.dueDate ? `<p style="color:#6b7280;margin:0">Due: ${params.dueDate}</p>` : ''}
          </div>
          <a href="${params.taskUrl}" style="display:inline-block;background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View Task
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}

export function taskDueSoonEmail(params: {
  recipientName: string
  taskTitle: string
  dueDate: string
  taskUrl: string
}) {
  return {
    subject: `[OASIS Hub] Task due soon: ${params.taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#f59e0b;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — Task Reminder</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>This is a reminder that a task is due soon.</p>
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 8px;color:#111827">${params.taskTitle}</h3>
            <p style="color:#92400e;margin:0;font-weight:600">Due: ${params.dueDate}</p>
          </div>
          <a href="${params.taskUrl}" style="display:inline-block;background:#f59e0b;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View Task
          </a>
        </div>
      </div>
    `,
  }
}

export function welcomeUserEmail(params: {
  recipientName: string
  email: string
  defaultPassword: string
  loginUrl: string
}) {
  return {
    subject: `Welcome to OASIS Hub — Your account is ready`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Welcome to OASIS Hub</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>Your OASIS Hub account has been created. You can log in using the credentials below:</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px"><strong>Email:</strong> ${params.email}</p>
            <p style="margin:0"><strong>Temporary Password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${params.defaultPassword}</code></p>
          </div>
          <p style="color:#dc2626;font-weight:600">You will be required to change your password on first login.</p>
          <a href="${params.loginUrl}" style="display:inline-block;background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            Login to OASIS Hub
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you did not expect this email, please contact your system administrator.</p>
        </div>
      </div>
    `,
  }
}

export function okrAssignedEmail(params: {
  recipientName: string
  objectiveTitle: string
  assignedBy: string
  dueDate?: string
  okrUrl: string
}) {
  return {
    subject: `[OASIS Hub] OKR assigned to you: ${params.objectiveTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#7c3aed;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — OKR Assignment</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>You have been assigned to an OKR by <strong>${params.assignedBy}</strong>.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 8px;color:#111827">${params.objectiveTitle}</h3>
            ${params.dueDate ? `<p style="color:#6b7280;margin:0">Target date: ${params.dueDate}</p>` : ''}
          </div>
          <a href="${params.okrUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View OKR
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}

export function atemAssignedEmail(params: {
  recipientName: string
  atemTask: string
  assignedBy: string
  deadline?: string
  atemUrl: string
}) {
  return {
    subject: `[OASIS Hub] ATEM item assigned to you: ${params.atemTask}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0891b2;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — ATEM Assignment</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>You have been assigned to an ATEM item by <strong>${params.assignedBy}</strong>.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 8px;color:#111827">${params.atemTask}</h3>
            ${params.deadline ? `<p style="color:#6b7280;margin:0">Deadline: ${params.deadline}</p>` : ''}
          </div>
          <a href="${params.atemUrl}" style="display:inline-block;background:#0891b2;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View ATEM
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}

export function okrMentionEmail(params: {
  recipientName: string
  objectiveTitle: string
  mentionedBy: string
  okrUrl: string
}) {
  return {
    subject: `[OASIS Hub] ${params.mentionedBy} mentioned you in OKR "${params.objectiveTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#7c3aed;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — OKR Mention</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p><strong>${params.mentionedBy}</strong> mentioned you in a comment on an OKR objective.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0;color:#111827">${params.objectiveTitle}</h3>
          </div>
          <a href="${params.okrUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View OKR
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}

export function atemMentionEmail(params: {
  recipientName: string
  atemTask: string
  mentionedBy: string
  atemUrl: string
}) {
  return {
    subject: `[OASIS Hub] ${params.mentionedBy} mentioned you in ATEM "${params.atemTask}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0891b2;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — ATEM Mention</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p><strong>${params.mentionedBy}</strong> mentioned you in a comment on an ATEM item.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0;color:#111827">${params.atemTask}</h3>
          </div>
          <a href="${params.atemUrl}" style="display:inline-block;background:#0891b2;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            View ATEM
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
        </div>
      </div>
    `,
  }
}

export function formAssignedEmail(params: {
  recipientName: string
  formTitle: string
  dueDate?: string
  formUrl: string
}) {
  return {
    subject: `[OASIS Hub] Form assigned: ${params.formTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#8b5cf6;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">OASIS Hub — Form Assignment</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
          <p>Hi <strong>${params.recipientName}</strong>,</p>
          <p>A new form has been assigned to you for completion.</p>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 8px">${params.formTitle}</h3>
            ${params.dueDate ? `<p style="color:#6b7280;margin:0">Due: ${params.dueDate}</p>` : ''}
          </div>
          <a href="${params.formUrl}" style="display:inline-block;background:#8b5cf6;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            Open Form
          </a>
        </div>
      </div>
    `,
  }
}
