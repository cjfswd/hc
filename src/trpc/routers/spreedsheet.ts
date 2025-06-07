// utils/emailSpreadsheet.ts
import z from 'zod/v4';
import { sheetsClient, updateToken } from '../googleoauth';
import { baseProcedure } from '../init';

export const expectedHeader = ["COD", "NOME", "PAD", "FISIO", "FONO", "NUTRI", "MEDICO", "ENFERMEIRO", "12H", "24H", "PONTUAL (3H)"] as const;

export const schema = {
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

export const padRequired = {
    "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO": ["NUTRI", "MEDICO", "ENFERMEIRO", "FISIO", "FONO"],
    "ASSISTENCIA 2 - FISIO / FONO": ["FISIO", "FONO"],
    "ASSISTENCIA 3 - FISIO": ["FISIO"],
    "12 H": ["12H"],
    "24 H": ["24H"],
    "PONTUAL (3H)": ["PONTUAL (3H)"],
};

export const isGoogleDriveFile = (url?: string) =>
    url ? /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=)/.test(url) : false;

export function parseSpreadsheet(rows: string[][]): { header: string[], data: string[][] } {
    return { header: rows[0], data: rows.slice(1) };
}

export function validateRow(row: string[], header: string[]): string[] {
    const errors: string[] = [];
    const getIndex = (col: string) => header.indexOf(col);
    const rowIndex = header.indexOf(row[0]) + 2;

    const cod = row[getIndex("COD")];
    const nome = row[getIndex("NOME")];
    const pad = row[getIndex("PAD")]?.trim();

    if (!cod || isNaN(Number(cod))) {
        errors.push(`Linha ${rowIndex}: COD inválido (${cod})`);
    }

    if (!nome) {
        errors.push(`Linha ${rowIndex}: NOME está vazio`);
    }

    if (!schema["PAD"].includes(pad)) {
        errors.push(`Linha ${rowIndex}: PAD inválido (${pad})`);
        return errors;
    }

    for (const key of expectedHeader.slice(3)) {
        const val = row[getIndex(key)];
        if (schema[key].includes("arquivo") && val && !isGoogleDriveFile(val)) {
            errors.push(`Linha ${rowIndex}: ${key} não é um link válido do Google Drive`);
        }
    }

    for (const col of padRequired[pad as keyof typeof padRequired] || []) {
        const val = row[getIndex(col)];
        if (!val || !isGoogleDriveFile(val)) {
            errors.push(`Linha ${rowIndex}: campo obrigatório ${col} ausente ou inválido`);
        }
    }

    return errors;
}

export async function getSpreadsheetData(spreadsheetId: string, sheetName: string) {
    const result = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName });
    const rows = result.data.values || [];
    if (!rows.length) throw new Error("Planilha está vazia");
    const { header, data } = parseSpreadsheet(rows);
    return { header, data };
}


export const previewSpreadsheet = baseProcedure
    .input(z.object({ spreadsheetId: z.string(), sheetName: z.string() }))
    .mutation(async ({ input }) => {
        await updateToken();

        const { header, data } = await getSpreadsheetData(input.spreadsheetId, input.sheetName);
        const errors: string[] = [];

        for (const row of data) {
            errors.push(...validateRow(row, header));
        }

        return { header, rows: data, errors };
    });