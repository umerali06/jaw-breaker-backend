import auditService from "./auditService.js";

export async function audit(actorId, action, metadata = {}) {
  try {
    await auditService.logAction({
      actorId,
      action,
      patientId: metadata.patientId,
      entity: metadata.entity || {},
      meta: metadata,
      at: new Date()
    });
  } catch (e) {
    /* do not block */
    console.error("Audit logging failed:", e);
  }
}
