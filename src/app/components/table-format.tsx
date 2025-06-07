import { Badge } from "@/components/ui/badge";

export default function SpreadsheetHeader() {
    const columns = [
        { label: "COD", type: ["númerico"] },
        { label: "NOME", type: ["texto"] },
        {
            label: "PAD", type: [
                "ASSISTENCIA 1 - NUTRI / MEDICO / ENFERMEIRO / FISIO / FONO",
                "ASSISTENCIA 2 - FISIO / FONO",
                "ASSISTENCIA 3 - FISIO ",
                "12 H",
                "24 H",
                "PONTUAL (3H)",
            ]
        },
        { label: "FISIO", type: ["arquivo"] },
        { label: "FONO", type: ["arquivo"] },
        { label: "NUTRI", type: ["arquivo"] },
        { label: "MEDICO", type: ["arquivo"] },
        { label: "ENFERMEIRO", type: ["arquivo"] },
        { label: "12H", type: ["arquivo"] },
        { label: "24H", type: ["arquivo"] },
        { label: "PONTUAL (3H)", type: ["arquivo"] },
    ];

    return (
        <div className="grid grid-cols-[repeat(11,min-content)] text-sm font-medium text-[9px]">
            {columns.map((col, idx) => (
                <div
                    key={`label-${idx}`}
                    className={`
            w-fit p-2 border-t border-b border-gray-300
            ${idx !== 0 ? "border-l" : ""}
            ${idx === 0 ? "rounded-tl-md border-l border-l-gray-300" : ""}
            ${idx === columns.length - 1 ? "rounded-tr-md border-r" : ""}
            flex flex-col items-center
            whitespace-nowrap
          `}
                    style={{ minWidth: 0 }}
                >
                    <div className="break-words text-center">{col.label}</div>
                    <div className="flex flex-wrap justify-center gap-1 mt-1">
                        {col.type.map((type, tIdx) => (
                            <Badge key={tIdx} variant="outline" className="text-[10px]">
                                {type}
                            </Badge>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
