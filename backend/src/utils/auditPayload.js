function pickEntityName(entity, candidates = []) {
  if (!entity || typeof entity !== 'object') return null;
  for (const candidate of candidates) {
    if (entity[candidate]) return entity[candidate];
  }
  return null;
}

function chainAuditPayload(chain) {
  if (!chain) return null;
  return {
    entityType: 'CHAIN',
    entityId: chain.chainId || chain.CHAIN_ID,
    entityName: chain.chainName || chain.CHAIN_NAME,
    values: {
      chainId: chain.chainId || chain.CHAIN_ID,
      chainCode: chain.chainCode || chain.CHAIN_CODE,
      chainName: chain.chainName || chain.CHAIN_NAME,
      status: chain.status || chain.STATUS
    }
  };
}

function hotelAuditPayload(hotel) {
  if (!hotel) return null;
  return {
    entityType: 'HOTEL',
    entityId: hotel.hotelId || hotel.HOTEL_ID,
    entityName: hotel.hotelName || hotel.HOTEL_NAME,
    values: {
      hotelId: hotel.hotelId || hotel.HOTEL_ID,
      chainId: hotel.chainId || hotel.CHAIN_ID,
      hotelCode: hotel.hotelCode || hotel.HOTEL_CODE,
      hotelName: hotel.hotelName || hotel.HOTEL_NAME,
      status: hotel.status || hotel.STATUS
    }
  };
}

function templateAuditPayload(template) {
  if (!template) return null;
  return {
    entityType: 'TEMPLATE',
    entityId: template.templateId || template.TEMPLATE_ID,
    entityName: pickEntityName(template, ['templateName', 'TEMPLATE_NAME', 'name', 'NAME']),
    values: {
      templateId: template.templateId || template.TEMPLATE_ID,
      templateCode: template.templateCode || template.TEMPLATE_CODE,
      templateName: template.templateName || template.TEMPLATE_NAME || template.name || template.NAME,
      status: template.status || template.STATUS,
      scopeType: template.scopeType || template.SCOPE_TYPE
    }
  };
}

module.exports = {
  chainAuditPayload,
  hotelAuditPayload,
  templateAuditPayload
};
