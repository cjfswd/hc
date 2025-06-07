import path from "path";
import MailComposer from "nodemailer/lib/mail-composer";
import { gmailClient, driveClient, updateToken } from '../googleoauth';
import { getSpreadsheetData, padRequired, validateRow } from "./spreedsheet";
import z from "zod/v4";
import { baseProcedure } from "../init";

export async function sendEmailForRow(
    row: string[],
    header: string[],
    destinatario: string,
    year: string,
    month: string
) {
    const getIndex = (col: string) => header.indexOf(col);
    const cod = row[getIndex("COD")];
    const nome = row[getIndex("NOME")];
    const pad = row[getIndex("PAD")]?.trim();
    const requiredCols = padRequired[pad as keyof typeof padRequired];
    const attachments: { filename: string; content: Buffer }[] = [];

    await Promise.all(requiredCols.map(async (col) => {
        const val = row[getIndex(col)];
        const fileId = val?.match(/[-\w]{25,}/)?.[0];
        if (!fileId) return;

        const [meta, file] = await Promise.all([
            driveClient.files.get({ fileId, fields: "name" }),
            driveClient.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" }),
        ]);

        const ext = path.extname(meta.data.name!);
        attachments.push({ filename: `${col}${ext}`, content: Buffer.from(file.data as ArrayBuffer) });
    }));

    if (!attachments.length) throw new Error("Nenhum anexo válido");

    const text = `Olá,\n\nSegue em anexo os documentos de ${nome}.\n\nCOD: ${cod}\nPAD: ${pad}\nPeríodo: ${month}/${year}\n\nAtenciosamente,\nEquipe Health Care`;

    const mail = new MailComposer({
        to: destinatario,
        subject: `Healthcare - PAD de ${nome} ${year}/${month}`,
        text,
        html: text.replace(/\n/g, "<br>"),
        attachments,
    });

    const message = await mail.compile().build();
    const raw = message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await gmailClient.users.messages.send({ userId: "me", requestBody: { raw } });
}

export const sendEmailRow = baseProcedure
    .input(z.object({
        spreadsheetId: z.string(),
        sheetName: z.string(),
        rowIndex: z.number(),
        destinatario: z.string().email(),
        year: z.string().regex(/^\d{4}$/),
        month: z.string().regex(/^(0[1-9]|1[0-2])$/),
    }))
    .mutation(async ({ input }) => {
        await updateToken(); // Ensure the token is updated before making requests

        const { header, data } = await getSpreadsheetData(input.spreadsheetId, input.sheetName);
        const row = data[input.rowIndex];

        if (!row) throw new Error("Linha inválida");

        const validationErrors = validateRow(row, header);
        if (validationErrors.length) return { errors: validationErrors };

        await sendEmailForRow(row, header, input.destinatario, input.year, input.month);
        return { ok: true };
    });