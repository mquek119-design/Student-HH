import type { Database } from '@/lib/supabase/database.types';
type Pub = Database['public'];

// Re-declare the constraint locally (it is not exported).
type GenericRelationship = { foreignKeyName: string; columns: string[]; isOneToOne?: boolean; referencedRelation: string; referencedColumns: string[] };
type GenericTable = { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: GenericRelationship[] };
type GenericFunction = { Args: Record<string, unknown> | never; Returns: unknown };

type TablesOK = Pub['Tables'] extends Record<string, GenericTable> ? true : false;
type ViewsOK = Pub['Views'] extends Record<string, unknown> ? true : false;
type FnsOK = Pub['Functions'] extends Record<string, GenericFunction> ? true : false;

export const t: TablesOK = true;
export const v: ViewsOK = true;
export const f: FnsOK = true;
