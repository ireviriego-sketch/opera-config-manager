const ALLOWED_STATUS = new Set(['DRAFT', 'READY', 'SENT_OK', 'SENT_ERROR', 'CANCELLED']);

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function cleanName(value) {
  const output = String(value || '').trim();
  if (!output) throw badRequest('DEPLOYMENT_NAME is required');
  if (output.length > 200) throw badRequest('DEPLOYMENT_NAME cannot exceed 200 characters');
  return output;
}

function cleanStatus(value) {
  const output = String(value || 'DRAFT').trim().toUpperCase();
  if (!ALLOWED_STATUS.has(output)) throw badRequest('STATUS must be DRAFT, READY, SENT_OK, SENT_ERROR or CANCELLED');
  return output;
}

function cleanComments(value) {
  const output = String(value || '').trim();
  if (output.length > 1000) throw badRequest('COMMENTS cannot exceed 1000 characters');
  return output || null;
}

function cleanOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const output = Number(value);
  if (Number.isNaN(output)) throw badRequest('SOURCE_TEMPLATE_VERSION_ID must be numeric');
  return output;
}

function validateCreatePayload(body) {
  return {
    deploymentName: cleanName(body.deploymentName),
    comments: cleanComments(body.comments),
    sourceTemplateVersionId: cleanOptionalNumber(body.sourceTemplateVersionId)
  };
}

function validateUpdatePayload(body) {
  return {
    deploymentName: cleanName(body.deploymentName),
    status: cleanStatus(body.status),
    comments: cleanComments(body.comments),
    sourceTemplateVersionId: cleanOptionalNumber(body.sourceTemplateVersionId)
  };
}

module.exports = { validateCreatePayload, validateUpdatePayload };
