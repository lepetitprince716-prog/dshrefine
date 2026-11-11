import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { useFieldControl } from "./field.tsx";
import { CheckGlyph, DashGlyph } from "./glyphs.tsx";
import { cx, edgeEnabled, nextEnabled } from "./util.ts";

export interface SwitchProps {
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	/** Visible label next to the switch; clicking it toggles. */
	readonly label?: ReactNode;
	/** Accessible name when there is no visible label and no enclosing `Field`. */
	readonly "aria-label"?: string;
	readonly "aria-describedby"?: string;
	readonly disabled?: boolean;
	readonly id?: string;
	readonly className?: string;
}

/** `role="switch"` button with `aria-checked`; Space and Enter toggle (native button). */
export function Switch({
	checked,
	onChange,
	label,
	"aria-label": ariaLabel,
	"aria-describedby": describedBy,
	disabled,
	id,
	className,
}: SwitchProps) {
	const auto = useId();
	const field = useFieldControl({ id, "aria-describedby": describedBy, disabled });
	const controlId = field.id ?? `rf-switch-${auto}`;
	const hasLabel = label !== undefined && label !== null;
	const labelledBy = hasLabel
		? `${controlId}-label`
		: ariaLabel === undefined
			? field.labelId
			: undefined;
	return (
		<span className={cx("rf-switch-field", className)} data-disabled={field.disabled || undefined}>
			<button
				type="button"
				role="switch"
				id={controlId}
				className="rf-switch"
				aria-checked={checked}
				aria-label={ariaLabel}
				aria-labelledby={labelledBy}
				aria-describedby={field.describedBy}
				disabled={field.disabled}
				onClick={() => onChange(!checked)}
			>
				<span className="rf-switch-track" aria-hidden="true">
					<span className="rf-switch-thumb" />
				</span>
			</button>
			{hasLabel ? (
				<label className="rf-switch-label" id={`${controlId}-label`} htmlFor={controlId}>
					{label}
				</label>
			) : null}
		</span>
	);
}

export interface CheckboxProps {
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly label?: ReactNode;
	readonly "aria-label"?: string;
	readonly "aria-describedby"?: string;
	/** Mixed state; the next click reports `checked: true`. */
	readonly indeterminate?: boolean;
	readonly disabled?: boolean;
	readonly id?: string;
	readonly className?: string;
}

/** Native checkbox (keyboard and form semantics) drawn with kit tokens. */
export function Checkbox({
	checked,
	onChange,
	label,
	"aria-label": ariaLabel,
	"aria-describedby": describedBy,
	indeterminate = false,
	disabled,
	id,
	className,
}: CheckboxProps) {
	const input = useRef<HTMLInputElement | null>(null);
	const field = useFieldControl({ id, "aria-describedby": describedBy, disabled });
	useEffect(() => {
		if (input.current !== null) input.current.indeterminate = indeterminate;
	}, [indeterminate]);
	return (
		<label className={cx("rf-checkbox", className)} data-disabled={field.disabled || undefined}>
			<input
				ref={input}
				type="checkbox"
				className="rf-checkbox-input"
				id={field.id}
				checked={checked}
				aria-label={ariaLabel}
				aria-describedby={field.describedBy}
				disabled={field.disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span className="rf-checkbox-box" aria-hidden="true">
				{indeterminate ? <DashGlyph size={12} /> : checked ? <CheckGlyph size={12} /> : null}
			</span>
			{label === undefined || label === null ? null : (
				<span className="rf-checkbox-label">{label}</span>
			)}
		</label>
	);
}

export interface SegmentedTabItem<V extends string> {
	readonly value: V;
	readonly label: ReactNode;
	readonly icon?: ReactNode;
	readonly disabled?: boolean;
	/** Accessible name for icon-only segments. */
	readonly "aria-label"?: string;
	/** Id of the panel this tab controls. */
	readonly panelId?: string;
}

export interface SegmentedTabsProps<V extends string> {
	readonly value: V;
	readonly onChange: (value: V) => void;
	readonly items: readonly SegmentedTabItem<V>[];
	/** Accessible name of the tab list. */
	readonly label: string;
	readonly size?: "sm" | "md";
	readonly className?: string;
}

/** `role="tablist"` segmented control; arrow keys move and select (automatic activation). */
export function SegmentedTabs<V extends string>({
	value,
	onChange,
	items,
	label,
	size = "md",
	className,
}: SegmentedTabsProps<V>) {
	const refs = useRef<(HTMLButtonElement | null)[]>([]);
	const disabled = items.map((item) => item.disabled === true);
	const selected = items.findIndex((item) => item.value === value && item.disabled !== true);
	const tabbable = selected >= 0 ? selected : edgeEnabled(disabled, 1);

	const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
		let next = -1;
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			next = nextEnabled(disabled, index, 1);
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			next = nextEnabled(disabled, index, -1);
		else if (event.key === "Home") next = edgeEnabled(disabled, 1);
		else if (event.key === "End") next = edgeEnabled(disabled, -1);
		const item = items[next];
		if (item === undefined) return;
		event.preventDefault();
		refs.current[next]?.focus();
		if (item.value !== value) onChange(item.value);
	};

	return (
		<div
			role="tablist"
			aria-label={label}
			className={cx("rf-segmented", `rf-segmented-${size}`, className)}
		>
			{items.map((item, index) => (
				<button
					key={item.value}
					ref={(node) => {
						refs.current[index] = node;
					}}
					type="button"
					role="tab"
					className="rf-segment"
					aria-selected={index === selected}
					aria-controls={item.panelId}
					aria-label={item["aria-label"]}
					tabIndex={index === tabbable ? 0 : -1}
					disabled={item.disabled}
					onClick={() => {
						if (item.value !== value) onChange(item.value);
					}}
					onKeyDown={(event) => move(event, index)}
				>
					{item.icon === undefined ? null : (
						<span className="rf-segment-glyph" aria-hidden="true">
							{item.icon}
						</span>
					)}
					<span className="rf-segment-label">{item.label}</span>
				</button>
			))}
		</div>
	);
}
