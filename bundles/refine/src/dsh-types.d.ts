// Minimal structural typings for the client services this bundle uses, derived by hand from the
// installed @deepseek-ai 0.2.1 client declarations.
import type { ReactNode } from "react";

export type Disposer = () => unknown;
export type SessionId = string;

export interface ClientLocale {
	register(
		ns: string,
		dictionaries: { zh: Record<string, string>; en: Record<string, string> },
	): () => void;
	bind(ns: string): (key: string, params?: Record<string, string | number>) => string;
}

export interface ClientSlots {
	inject(owner: string, register: () => Disposer | undefined): Disposer;
	register(options: SlotRegistration, component: (props: never) => ReactNode): Disposer;
}

export interface SlotRegistration {
	readonly name: string;
	readonly id?: string;
	readonly order?: number;
	readonly priority?: number;
	readonly label?: () => string;
	readonly locale?: string;
	readonly inject?: (...args: never[]) => Record<string, unknown>;
}

export interface SessionSnapshot {
	readonly sessionId: SessionId;
	readonly running: boolean;
	readonly blank: boolean;
}

export interface ClientContext {
	effect(execute: () => Disposer | undefined, label?: string): Disposer;
	readonly slots: ClientSlots;
	readonly locale: ClientLocale;
	readonly uiWorkspace: { openSession(target: SessionId): void };
}

export interface SessionSlotProps {
	readonly sessionId: SessionId;
	readonly useSession: <S>(selector: (snapshot: SessionSnapshot) => S) => S;
	readonly t: (key: string, params?: Record<string, string | number>) => string;
}
