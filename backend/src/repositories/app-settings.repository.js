const { execute } = require('../db/query');

async function getFooterConfig() {
  const settingsResult = await execute(`
    SELECT
      SETTING_KEY,
      DBMS_LOB.SUBSTR(SETTING_VALUE, 4000, 1) AS SETTING_VALUE
    FROM OPERA_CFG_APP.OPERA_CFG_APP_SETTINGS
    WHERE SETTING_KEY IN (
      'FOOTER_COPYRIGHT_TEXT',
      'FOOTER_ENABLED'
    )
  `);

  const settings = {};
  (settingsResult.rows || []).forEach(row => {
    settings[row.SETTING_KEY] = row.SETTING_VALUE;
  });

  const linksResult = await execute(`
    SELECT
      FOOTER_LINK_ID,
      LINK_TEXT,
      LINK_URL,
      DISPLAY_ORDER,
      STATUS
    FROM OPERA_CFG_APP.OPERA_CFG_FOOTER_LINKS
    WHERE STATUS = 'ACTIVE'
    ORDER BY DISPLAY_ORDER, FOOTER_LINK_ID
  `);

  return {
    enabled: (settings.FOOTER_ENABLED || 'Y') !== 'N',
    copyrightText:
      settings.FOOTER_COPYRIGHT_TEXT ||
      'Accenture. All rights reserved.',
    links: (linksResult.rows || []).map(row => ({
      footerLinkId: row.FOOTER_LINK_ID,
      text: row.LINK_TEXT,
      url: row.LINK_URL,
      displayOrder: row.DISPLAY_ORDER,
      status: row.STATUS
    }))
  };
}

async function saveFooterConfig(payload) {
  await execute(`
    MERGE INTO OPERA_CFG_APP.OPERA_CFG_APP_SETTINGS t
    USING (
      SELECT
        'FOOTER_ENABLED' SETTING_KEY,
        :value SETTING_VALUE
      FROM dual
    ) s
    ON (t.SETTING_KEY = s.SETTING_KEY)
    WHEN MATCHED THEN
      UPDATE SET
        t.SETTING_VALUE = s.SETTING_VALUE,
        t.UPDATED_AT = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (
        SETTING_KEY,
        SETTING_VALUE,
        DESCRIPTION,
        STATUS
      )
      VALUES (
        s.SETTING_KEY,
        s.SETTING_VALUE,
        'Controls whether the common footer is displayed.',
        'ACTIVE'
      )
  `, {
    value: payload.enabled === false ? 'N' : 'Y'
  }, {
    autoCommit: true
  });

  await execute(`
    MERGE INTO OPERA_CFG_APP.OPERA_CFG_APP_SETTINGS t
    USING (
      SELECT
        'FOOTER_COPYRIGHT_TEXT' SETTING_KEY,
        :value SETTING_VALUE
      FROM dual
    ) s
    ON (t.SETTING_KEY = s.SETTING_KEY)
    WHEN MATCHED THEN
      UPDATE SET
        t.SETTING_VALUE = s.SETTING_VALUE,
        t.UPDATED_AT = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (
        SETTING_KEY,
        SETTING_VALUE,
        DESCRIPTION,
        STATUS
      )
      VALUES (
        s.SETTING_KEY,
        s.SETTING_VALUE,
        'Text displayed after the dynamic copyright year.',
        'ACTIVE'
      )
  `, {
    value: payload.copyrightText || ''
  }, {
    autoCommit: true
  });

  await execute(
    `DELETE FROM OPERA_CFG_APP.OPERA_CFG_FOOTER_LINKS`,
    {},
    { autoCommit: true }
  );

  const links = Array.isArray(payload.links)
    ? payload.links
    : [];

  for (const [index, link] of links.entries()) {
    const text = String(link.text || '').trim();
    const url = String(link.url || '').trim();

    if (!text || !url) continue;

    await execute(`
      INSERT INTO OPERA_CFG_APP.OPERA_CFG_FOOTER_LINKS (
        LINK_TEXT,
        LINK_URL,
        DISPLAY_ORDER,
        STATUS
      )
      VALUES (
        :text,
        :url,
        :displayOrder,
        :status
      )
    `, {
      text,
      url,
      displayOrder:
        Number(link.displayOrder || ((index + 1) * 10)),
      status:
        link.status === 'INACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE'
    }, {
      autoCommit: true
    });
  }

  return getFooterConfig();
}

module.exports = {
  getFooterConfig,
  saveFooterConfig
};