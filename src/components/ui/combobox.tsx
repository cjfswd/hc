"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: ComboboxOption[];
  placeholder?: string;
}

export function Combobox({
  value,
  onChange,
  disabled = false,
  options,
  placeholder = "Selecione...",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Mostrar o label da opção selecionada ou placeholder
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            disabled && "cursor-not-allowed opacity-50"
          )}
          disabled={disabled}
        >
          {selectedLabel}
          <ChevronsUpDown className="opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder={`Buscar ${placeholder.toLowerCase()}`}
            className="h-9"
            autoFocus
          />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // <- label será pesquisável
                  onSelect={() => {
                    onChange(option.value); // <- value (ID) será atribuído no form
                    setOpen(false);
                  }}
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
