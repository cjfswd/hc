import { z } from 'zod/v4';
import { baseProcedure, createTRPCRouter } from '../init';
import { listSheets, listSpreadsheets, sendEmails, 
  // validateSpreadsheet 
} from './send-email';
import { previewSpreadsheet } from './spreedsheet';
import { sendEmailRow } from './email';
//import { sendEmails } from './send-email';
export const appRouter = createTRPCRouter({
  hello: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query(async (opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
  sendEmails,
  listSheets,
  listSpreadsheets,
  previewSpreadsheet,
  sendEmailRow,
  // validateSpreadsheet
});
// export type definition of API
export type AppRouter = typeof appRouter;