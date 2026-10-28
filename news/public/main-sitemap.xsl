<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title>Music Mundial XML Sitemap</title>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0; padding: 24px; background: #fff; }
          h1 { font-size: 24px; font-weight: 500; margin: 0 0 8px; }
          p { margin: 0 0 16px; color: #555; line-height: 1.5; }
          a { color: #05809e; text-decoration: none; }
          a:hover { text-decoration: underline; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #2a6ebb; color: #fff; text-align: left; padding: 10px 12px; font-weight: 600; }
          td { padding: 10px 12px; border-bottom: 1px solid #e6e6e6; vertical-align: top; word-break: break-all; }
          tr:nth-child(even) td { background: #f7f7f7; }
          .count { margin-bottom: 18px; }
        </style>
      </head>
      <body>
        <xsl:choose>
          <xsl:when test="sitemap:sitemapindex">
            <h1>XML Sitemap Index</h1>
            <p>This XML Sitemap Index file contains <xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/> sitemaps.</p>
            <table>
              <tr>
                <th>Sitemap</th>
                <th>Last Modified</th>
              </tr>
              <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
                <tr>
                  <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
                  <td><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:when>
          <xsl:otherwise>
            <h1>XML Sitemap</h1>
            <p class="count">This XML Sitemap contains <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> URLs.</p>
            <p><a href="/sitemap_index.xml">← Sitemap Index</a></p>
            <table>
              <tr>
                <th>URL</th>
                <th>Images</th>
                <th>Last Modified</th>
              </tr>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
                  <td><xsl:value-of select="count(image:image)"/></td>
                  <td><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:otherwise>
        </xsl:choose>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
