import { baseProcedure } from '@/trpc/init'; // ou protectedProcedure
import { google } from 'googleapis';
import { auth } from '@/auth'
import { z } from 'zod';
import MailComposer from 'nodemailer/lib/mail-composer';
import path from "path";

const oauth2Client = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  redirectUri: process.env.NEXT_PUBLIC_BASE_URL + "/api/auth/callback/google" || "http://localhost:3000/api/auth/callback/google", // Ajuste conforme necessário
});

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export const sendEmails = baseProcedure
  .input(z.object({
    spreadSheetName: z.string(),
    spreadsheetId: z.string(),
    sheetName: z.string(),
    destinatario: z.string().email(),
    year: z.string().regex(/^\d{4}$/), // Ex: "2025"
    month: z.string().regex(/^(0[1-9]|1[0-2])$/), // Ex: "06"
  }))
  .mutation(async ({ input }) => {
    const start = Date.now(); // ← Start timer
    const session = await auth();
    oauth2Client.setCredentials({ access_token: session?.access_token });

    const { spreadsheetId, sheetName, destinatario, year, month } = input;

    const result = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });

    const rows = result.data.values || [];

    const errors: string[] = [];
    const expectedHeader = ["COD", "NOME", "PAD", "FISIO", "FONO", "NUTRI", "MEDICO", "ENFERMEIRO", "12H", "24H", "PONTUAL (3H)"] as const;
    const schema = {
      "COD": ["númerico"],
      "NOME": ["texto"],
      "PAD": [
        "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO",
        "ASSISTENCIA 2 - FISIO / FONO",
        "ASSISTENCIA 3 - FISIO",
        "12 H",
        "24 H",
        "PONTUAL (3H)",
      ],
      "FISIO": ["arquivo"],
      "FONO": ["arquivo"],
      "NUTRI": ["arquivo"],
      "MEDICO": ["arquivo"],
      "ENFERMEIRO": ["arquivo"],
      "12H": ["arquivo"],
      "24H": ["arquivo"],
      "PONTUAL (3H)": ["arquivo"],
    };

    const padRequired: Record<string, string[]> = {
      "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO": ["NUTRI", "MEDICO", "ENFERMEIRO", "FISIO", "FONO"],
      "ASSISTENCIA 2 - FISIO / FONO": ["FISIO", "FONO"],
      "ASSISTENCIA 3 - FISIO": ["FISIO"],
      "12 H": ["12H"],
      "24 H": ["24H"],
      "PONTUAL (3H)": ["PONTUAL (3H)"],
    };

    const isGoogleDriveFile = (url?: string) =>
      url ? /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=)/.test(url) : false;

    if (!rows.length) {
      return { errors: ["Planilha está vazia."], input };
    }

    const header = rows[0];
    if (header.join() !== expectedHeader.join()) {
      return { errors: ["Cabeçalho inválido: deve conter as colunas esperadas exatamente na mesma ordem."], input };
    }

    const getColumnIndex = (label: string) => header.indexOf(label);
    const data = rows.slice(1,
      // 4
    ); // processa até 3 linhas

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 2;

      const cod = row[getColumnIndex("COD")];
      const nome = row[getColumnIndex("NOME")];
      const pad = row[getColumnIndex("PAD")]?.trim();

      if (!cod || isNaN(Number(cod))) {
        errors.push(`Linha ${rowIndex}: COD inválido (${cod})`);
      }

      if (!nome) {
        errors.push(`Linha ${rowIndex}: NOME está vazio`);
      }

      if (!schema["PAD"].includes(pad)) {
        errors.push(`Linha ${rowIndex}: PAD inválido (${pad})`);
        continue;
      }

      for (const key of expectedHeader.slice(3)) {
        const val = row[getColumnIndex(key)];
        if (schema[key]?.includes("arquivo") && val && !isGoogleDriveFile(val)) {
          errors.push(`Linha ${rowIndex}: ${key} não é um link válido do Google Drive`);
        }
      }

      const requiredCols = padRequired[pad] || [];
      for (const col of requiredCols) {
        const value = row[getColumnIndex(col)];
        if (!value || !isGoogleDriveFile(value)) {
          errors.push(`Linha ${rowIndex}: campo obrigatório ${col} ausente ou inválido para o PAD "${pad}"`);
        }
      }
    }

    if (errors.length) {
      return { errors, input };
    }

    await Promise.all(data.map(async (row, index) => {
      const cod = row[getColumnIndex("COD")];
      const nome = row[getColumnIndex("NOME")];
      const pad = row[getColumnIndex("PAD")]?.trim();
      const requiredCols = padRequired[pad];
      const attachments: { filename: string, content: Buffer }[] = [];

      await Promise.all(
        requiredCols.map(async (col) => {
          const cellValue = row[getColumnIndex(col)];
          const match = cellValue?.match(/[-\w]{25,}/);
          const fileId = match ? match[0] : null;

          if (!fileId) return;

          try {
            const [fileMeta, response] = await Promise.all([
              drive.files.get({ fileId, fields: 'name' }),
              drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' }),
            ]);

            const ext = path.extname(fileMeta.data.name!);
            attachments.push({
              filename: `${col}${ext}`,
              content: Buffer.from(response.data as ArrayBuffer),
            });
          } catch (err) {
            console.error(`Erro ao buscar ou baixar arquivo ${fileId}`, err);
          }
        })
      );

      if (attachments.length === 0) return;

      const subject = `Healthcare - PAD de ${nome} ${year}/${month}`;
      const text = `Olá,\n\nSegue em anexo os documentos de ${nome}.\n\nCOD: ${cod}\nPAD: ${pad}\nPeríodo: ${month}/${year}\n\nAtenciosamente,\nEquipe Health Care`;

      const mail = new MailComposer({
        to: destinatario,
        subject,
        text,
        html: text.replace(/\n/g, '<br>'),
        attachments,
      });

      try {
        const message = await mail.compile().build();
        const raw = message.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });
      } catch (err) {
        console.error(`Erro ao enviar email para ${nome} (linha ${index + 2})`, err);
      }
    }));

    const end = Date.now(); // ← End timer
    const durationMs = end - start;

    console.log(`sendEmails executed in ${durationMs} ms`);
    return { ok: true, errors: [], input };
  });

export const listSheets = baseProcedure
  .input(z.object({ spreadsheetId: z.string().min(1) }))
  .query(async ({ input }) => {
    const session = await auth()

    oauth2Client.setCredentials({
      access_token: session?.access_token,
      token_type: "Bearer",
    });

    const resp = await sheets.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "sheets(properties(sheetId,title))"
    });

    return resp.data.sheets?.map(s => s.properties!) ?? [];
  })

export const listSpreadsheets = baseProcedure
  .query(async () => {
    const session = await auth();

    if (!session?.access_token) {
      throw new Error("Usuário não autenticado ou token de acesso ausente.");
    }

    oauth2Client.setCredentials({
      access_token: session.access_token,
      token_type: "Bearer",
    });

    // Opcional: Verificar escopos
    try {
      const tokenInfo = await oauth2Client.getTokenInfo(session.access_token);
      console.log("Scopes:", tokenInfo.scopes);
    } catch (err) {
      console.error("Erro ao obter escopos:", err);
    }

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: "files(id,name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return response.data.files ?? [];
  });

// function isGoogleDriveFile(url?: string): boolean {
//   if (!url) return false;
//   return /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=)/.test(url);
// }

// export const validateSpreadsheet = baseProcedure
//   .input(z.object({
//     spreadsheetId: z.string(),
//     sheetName: z.string(),
//   }))
//   .query(async ({ input }) => {
//     const session = await auth();

//     if (!session?.access_token) {
//       throw new Error("Usuário não autenticado.");
//     }

//     oauth2Client.setCredentials({ access_token: session.access_token });

//     const { spreadsheetId, sheetName } = input;

//     const result = await sheets.spreadsheets.values.get({
//       spreadsheetId,
//       range: sheetName,
//     });

//     const rows = result.data.values || [];
//     const errors: string[] = [];

//     const expectedHeader = ["COD", "NOME", "PAD", "FISIO", "FONO", "NUTRI", "MEDICO", "ENFERMEIRO", "12H", "24H", "PONTUAL (3H)"] as const;
//     const schema = {
//       "COD": ["númerico"],
//       "NOME": ["texto"],
//       "PAD": [
//         "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO",
//         "ASSISTENCIA 2 - FISIO / FONO",
//         "ASSISTENCIA 3 - FISIO",
//         "12 H",
//         "24 H",
//         "PONTUAL (3H)",
//       ],
//       "FISIO": ["arquivo"],
//       "FONO": ["arquivo"],
//       "NUTRI": ["arquivo"],
//       "MEDICO": ["arquivo"],
//       "ENFERMEIRO": ["arquivo"],
//       "12H": ["arquivo"],
//       "24H": ["arquivo"],
//       "PONTUAL (3H)": ["arquivo"],
//     };

//     if (!rows.length) {
//       errors.push("Planilha está vazia.");
//       return { errors };
//     }

//     const header = rows[0];
//     if (header.join() !== expectedHeader.join()) {
//       errors.push("Cabeçalho inválido: deve conter as colunas esperadas exatamente na mesma ordem.");
//       return { errors };
//     }

//     const getColumnIndex = (label: string) => header.indexOf(label);
//     const padRequired: Record<string, string[]> = {
//       "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO": ["NUTRI", "MEDICO", "ENFERMEIRO", "FISIO", "FONO"],
//       "ASSISTENCIA 2 - FISIO / FONO": ["FISIO", "FONO"],
//       "ASSISTENCIA 3 - FISIO ": ["FISIO"],
//       "12 H": ["12H"],
//       "24 H": ["24H"],
//       "PONTUAL (3H)": ["PONTUAL (3H)"],
//     };

//     for (let i = 1; i < rows.length; i++) {
//       const row = rows[i];
//       const rowIndex = i + 1;

//       const cod = row[getColumnIndex("COD")];
//       const nome = row[getColumnIndex("NOME")];
//       const pad = row[getColumnIndex("PAD")];

//       if (!cod || isNaN(Number(cod))) {
//         errors.push(`Linha ${rowIndex}: COD inválido (${cod})`);
//       }

//       if (!nome) {
//         errors.push(`Linha ${rowIndex}: NOME está vazio`);
//       }

//       const padTrimmed = pad?.trim() ?? "";

//       if (!schema["PAD"].includes(padTrimmed)) {
//         errors.push(`Linha ${rowIndex}: PAD inválido (${pad})`);
//         continue;
//       }

//       for (const key of expectedHeader.slice(3)) {
//         const val = row[getColumnIndex(key)];
//         const isArquivo = schema[key]?.includes("arquivo");
//         if (isArquivo && val && !isGoogleDriveFile(val)) {
//           errors.push(`Linha ${rowIndex}: ${key} não é um link válido do Google Drive`);
//         }
//       }

//       const requiredCols = padRequired[padTrimmed] || [];
//       for (const col of requiredCols) {
//         const value = row[getColumnIndex(col)];
//         if (!value || !isGoogleDriveFile(value)) {
//           errors.push(`Linha ${rowIndex}: campo obrigatório ${col} ausente ou inválido para o PAD "${pad}"`);
//         }
//       }
//     }

//     return { errors };
//   });

