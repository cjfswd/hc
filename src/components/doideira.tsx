"use client";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTRPC } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import TableFormat from "@/app/components/table-format";
import { useEffect, useState } from "react";
import { TypographyH1 } from '@/components/ui/typographyh1';
import { newQueue } from '@henrygd/queue'

const schema = z.object({
  spreadsheetId: z.string().min(1, "Selecione uma planilha"),
  sheetName: z.string().min(1, "Selecione uma aba"),
  destinatario: z.string().email("Email inválido"),
  year: z.string().regex(/^\d{4}$/, "Selecione um ano"), // Ex: "2025"
  month: z.string().regex(/^(0[1-9]|1[0-2])$/, "Selecione um mês"), // Ex: "06"
});

type FormData = z.infer<typeof schema>;

export function SendEmailsForm() {
  const [submittedSpreadsheetName, setSubmittedSpreadsheetName] = useState<string>("");
  const [submittedSheetName, setSubmittedSheetName] = useState<string>("");
  const [queueStatus, setQueueStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [rowErrors, setRowErrors] = useState<{ rowIndex: number; error: string }[]>([]);

  const trpc = useTRPC();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      spreadsheetId: "",
      sheetName: "",
      destinatario: "",
      year: "",     // <-- Novo
      month: "",
    },
  });

  const spreadsheetId = form.watch("spreadsheetId");

  const spreadsheetsQuery = useQuery({ ...trpc.listSpreadsheets.queryOptions(), enabled: false });

  const sheetsQuery = useQuery({ ...trpc.listSheets.queryOptions({ spreadsheetId }), enabled: false });

  useEffect(() => {
    console.log(spreadsheetsQuery.data)
  }, [spreadsheetsQuery])

  useEffect(() => {
    form.setValue("sheetName", "");
    sheetsQuery.refetch()
  }, [spreadsheetId]);

  // const sendEmails = useMutation(trpc.sendEmails.mutationOptions({
  //   onSuccess: (data) => {
  //     if (!data.errors || data.errors.length === 0 || data.ok) {
  //       form.reset({
  //         spreadsheetId: "",
  //         sheetName: "",
  //         destinatario: "",
  //         year: "",     // <-- Novo
  //         month: "",
  //       });
  //     }
  //   },
  // }));

  const previewSpreadsheetMutation = useMutation(trpc.previewSpreadsheet.mutationOptions());

  const sendEmailRowMutation = useMutation(trpc.sendEmailRow.mutationOptions());

  // const validationQuery = useQuery({
  //   ...trpc.validateSpreadsheet.queryOptions({
  //     spreadsheetId,
  //     sheetName: form.watch("sheetName"),
  //   }),
  //   enabled: !!spreadsheetId && !!form.watch("sheetName"),
  // });

  const onSubmit = async (data: FormData) => {
    console.log("Enviando emails com os dados:", data);

    // Reset de erros e status
    setQueueStatus("running");
    setRowErrors([]);

    if (!data.spreadsheetId.trim()) {
      form.setError("spreadsheetId", {
        type: "manual",
        message: "Você precisa selecionar uma planilha.",
      });
      return;
    }

    if (!data.sheetName.trim()) {
      form.setError("sheetName", {
        type: "manual",
        message: "Você precisa selecionar uma aba da planilha.",
      });
      return;
    }

    if (!data.destinatario.trim()) {
      form.setError("destinatario", {
        type: "manual",
        message: "Você precisa informar o e-mail do destinatário.",
      });
      return;
    }

    const spreadsheetName = spreadsheetsQuery.data?.find(
      (item) => item.id === data.spreadsheetId
    )?.name;

    if (!spreadsheetName) {
      form.setError("spreadsheetId", {
        type: "manual",
        message: "Planilha selecionada não foi encontrada.",
      });
      return;
    }

    setSubmittedSpreadsheetName(spreadsheetName);
    setSubmittedSheetName(data.sheetName);

    try {
      // Passo 1: Obter preview das linhas da planilha
      const preview = await previewSpreadsheetMutation.mutateAsync({
        spreadsheetId: data.spreadsheetId,
        sheetName: data.sheetName,
      });

      if (preview.errors && preview.errors.length > 0) {
        return;
      }

      // Passo 2: Criar fila
      const queue = newQueue(2);

      for (const [index] of preview.rows.entries()) {
        queue.add(async () => {
          try {
            await sendEmailRowMutation.mutateAsync({
              spreadsheetId: data.spreadsheetId,
              sheetName: data.sheetName,
              destinatario: data.destinatario,
              year: data.year,
              month: data.month,
              rowIndex: index,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Erro desconhecido";
            setRowErrors((prev) => [...prev, { rowIndex: index, error: message }]);
          }
        });
      }

      console.log("🟡 Executando fila...");
      await queue.done();
      console.log("✅ Fila finalizada");

      if (rowErrors.length === 0) {
        setQueueStatus("success");
        form.reset({
          spreadsheetId: "",
          sheetName: "",
          destinatario: "",
          year: "",
          month: "",
        });
      } else {
        setQueueStatus("error");
      }

    } catch (err) {
      console.error("Erro ao processar fila:", err);
      setQueueStatus("error");
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 p-6 bg-white rounded shadow"
      >
        <TypographyH1 className="text-start">Envio de PAD automatizado</TypographyH1>
        <div className="flex flex-col gap-2">
          <FormLabel>Formato esperado</FormLabel>
          <TableFormat />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => spreadsheetsQuery.refetch()}
          disabled={spreadsheetsQuery.isRefetching}
        >
          {spreadsheetsQuery.isRefetching ? "Atualizando..." : "Atualizar lista de planilhas"}
        </Button>
        {/* Planilha */}
        <FormField
          control={form.control}
          name="spreadsheetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Planilha</FormLabel>
              <Combobox
                {...field}
                options={spreadsheetsQuery.data?.map((ss) => {
                  return {
                    value: ss.id!,
                    label: ss.name!,
                  }
                }) ?? []}
                disabled={spreadsheetsQuery.isLoading || spreadsheetsQuery.isRefetching}
                placeholder="Selecione uma planilha"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Aba */}
        <FormField
          control={form.control}
          name="sheetName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aba da Planilha</FormLabel>
              <Combobox
                {...field}
                options={
                  sheetsQuery.data?.map((s) => ({
                    value: s.title!,
                    label: s.title!,
                  })) ?? []
                }
                disabled={sheetsQuery.isLoading || !spreadsheetId || spreadsheetsQuery.isRefetching}
                placeholder="Selecione uma aba"
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Destinatário */}
        <FormField
          control={form.control}
          name="destinatario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email do Destinatário</FormLabel>
              <Input
                type="email"
                {...field}
                placeholder="email@exemplo.com"
                disabled={sendEmailRowMutation.isPending}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Ano */}
        <FormField
          control={form.control}
          name="year"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ano</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={sendEmailRowMutation.isPending}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }).map((_, index) => {
                    const year = new Date().getFullYear() - index;
                    return (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Mês */}
        <FormField
          control={form.control}
          name="month"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mês</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={sendEmailRowMutation.isPending}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ["01", "Janeiro"],
                    ["02", "Fevereiro"],
                    ["03", "Março"],
                    ["04", "Abril"],
                    ["05", "Maio"],
                    ["06", "Junho"],
                    ["07", "Julho"],
                    ["08", "Agosto"],
                    ["09", "Setembro"],
                    ["10", "Outubro"],
                    ["11", "Novembro"],
                    ["12", "Dezembro"],
                  ].map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {value} - {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={
            sendEmailRowMutation.isPending ||
            spreadsheetsQuery.isLoading ||
            sheetsQuery.isLoading
            // ||
            // validationQuery.isFetching ||
            // (validationQuery.data?.errors.length ?? 0) > 0
          }
        >
          {sendEmailRowMutation.isPending ? "Enviando..." : "Enviar"}<br />
        </Button>
        {/* {validationQuery.isLoading && (
          <p className="text-blue-500">🔍 Validando planilha...</p>
        )} */}

        {/* {validationQuery.data?.errors && validationQuery.data.errors.length > 0 && (
          <div className="bg-red-100 text-red-800 p-4 rounded space-y-2 border border-red-300">
            <p className="font-semibold">❌ Erros encontrados na planilha:</p>
            <ul className="list-disc pl-6">
              {validationQuery.data.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validationQuery.data?.errors?.length === 0 && (
          <p className="text-green-600">✅ Nenhum erro encontrado na planilha.</p>
        )} */}
        {previewSpreadsheetMutation.data?.errors && previewSpreadsheetMutation.data.errors.length > 0 && (
          <div className="bg-red-100 text-red-800 p-4 rounded space-y-2 border border-red-300">
            <p className="font-semibold">
              ❌ Erros encontrados na planilha: &quot;{submittedSpreadsheetName}&quot; / aba: &quot;{submittedSheetName}&quot;
            </p>
            <ul className="list-disc pl-6">
              {previewSpreadsheetMutation.data.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* {validationQuery.data?.errors?.length === 0 && (
          <p className="text-green-600">✅ Nenhum erro encontrado na planilha.</p>
        )} */}
        {/* {(sendEmails.isSuccess && !(sendEmails.data?.errors && sendEmails.data.errors.length > 0)) && (
          <p className="text-green-600">✔️ Enviado com sucesso!</p>
        )}
        {(sendEmails.isError) && (
          <p className="text-red-600">❌ Erro na requisição: {sendEmails.error.message}</p>
        )} */}
        {queueStatus === "success" && rowErrors.length === 0 && (
          <p className="text-green-600">✔️ Todos os emails foram enviados com sucesso!</p>
        )}

        {queueStatus === "error" && rowErrors.length > 0 && (
          <div className="bg-red-100 text-red-800 p-4 rounded space-y-2 border border-red-300">
            <p className="font-semibold">❌ Alguns emails falharam:</p>
            <ul className="list-disc pl-6">
              {rowErrors.map(({ rowIndex, error }) => (
                <li key={rowIndex}>Linha {rowIndex + 1}: {error}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Form>
  );
}
