import { Table, TBody, Td, Th, THead, Tr } from "./table";

export interface DilutionRow {
  /** Concentrate to water, e.g. "1:40". */
  ratio: string;
  use: string;
  /** e.g. "5 min". */
  contactTime: string;
  note?: string;
}

export interface DilutionTableProps {
  rows: readonly DilutionRow[];
  caption?: string;
  captionVisible?: boolean;
  className?: string;
}

/** The dosing chart on every product page (plan §4.7, §6.7): mono ratios, tabular contact times. */
export function DilutionTable({ rows, caption = "Dilution ratios and contact times", captionVisible, className }: DilutionTableProps) {
  return (
    <Table caption={caption} captionVisible={captionVisible} wrapperClassName={className} className="min-w-80">
      <THead>
        <Tr className="border-t-0">
          <Th>Ratio</Th>
          <Th>Use</Th>
          <Th numeric>Contact time</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={`${row.ratio}-${row.use}`}>
            <Td mono>{row.ratio}</Td>
            <Td>
              {row.use}
              {row.note ? <span className="mt-1 block text-caption text-ink-muted">{row.note}</span> : null}
            </Td>
            <Td numeric>{row.contactTime}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
