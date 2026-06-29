export function baseEmail(content: string, previewText = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Workstation</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #0f0f14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    a { text-decoration: none; }
    img { border: 0; display: block; }
    .preheader { display: none !important; visibility: hidden; overflow: hidden; opacity: 0; height: 0; max-height: 0; }
  </style>
</head>
<body style="background-color:#0f0f14; margin:0; padding:0;">
  ${previewText ? `<span class="preheader" style="display:none;max-height:0;overflow:hidden;">${previewText}</span>` : ''}

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f14; min-height:100vh;">
    <tr>
      <td align="center" style="padding: 40px 16px 60px;">

        <!-- Card wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%); border-radius:16px 16px 0 0; padding: 36px 40px 32px; text-align:center;">
              <!-- Logo mark -->
              <table cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 10px 14px; backdrop-filter: blur(8px);">
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      Work<span style="color: #a5b4fc;">station</span>
                    </span>
                  </td>
                </tr>
              </table>
              <!-- Decorative line -->
              <div style="margin-top: 20px; height: 1px; background: linear-gradient(90deg, transparent, rgba(165,180,252,0.4), transparent);"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #16161f; border-left: 1px solid #2a2a3a; border-right: 1px solid #2a2a3a; padding: 40px 40px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111119; border: 1px solid #2a2a3a; border-top: none; border-radius: 0 0 16px 16px; padding: 24px 40px; text-align: center;">
              <p style="font-size: 11px; color: #4a4a6a; line-height: 1.6; margin: 0;">
                This email was sent by Workstation &mdash; Nigeria&rsquo;s professional recruitment platform.<br />
                If you did not expect this email, you can safely ignore it.<br /><br />
                &copy; ${new Date().getFullYear()} Workstation. All rights reserved.<br />
                <a href="https://workstation.ng" style="color: #6366f1; text-decoration: none;">workstation.ng</a>
              </p>
            </td>
          </tr>

          <!-- Bottom spacer -->
          <tr><td style="height: 24px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function ctaButton(href: string, label: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 28px auto 0;">
      <tr>
        <td align="center" style="background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 10px; box-shadow: 0 4px 20px rgba(99,102,241,0.35);">
          <a href="${href}" target="_blank"
            style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.2px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `
}

export function divider(): string {
  return `<div style="height:1px; background: linear-gradient(90deg, transparent, #2a2a3a, transparent); margin: 28px 0;"></div>`
}

export function infoBox(lines: string[]): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1e1e2e; border:1px solid #2a2a3a; border-radius:10px; margin:24px 0;">
      <tr><td style="padding:20px 22px;">
        ${lines.map(l => `<p style="font-size:13px; color:#a0a0c0; line-height:1.6; margin:0 0 4px;">${l}</p>`).join('')}
      </td></tr>
    </table>
  `
}

export function badge(text: string, color: '#6366f1' | '#10b981' | '#f59e0b' | '#ef4444' = '#6366f1'): string {
  const bg = color + '22'
  return `<span style="display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; color:${color}; background:${bg}; border:1px solid ${color}44;">${text}</span>`
}
