import {
	createContext,
	forwardRef,
	type InputHTMLAttributes,
	type ReactNode,
	type TextareaHTMLAttributes,
	useContext,
	useId,
	useLayoutEffect,
	useRef,
} from "react";
import { cx, joinIds } from "./util.ts";

interface FieldContextValue {
	readonly id: string;
	readonly labelId: string;
	readonly describedBy: string | undefined;
	readonly invalid: boolean;
	readonly disabled: boolean;
	readonly required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
	readonly label: ReactNode;
	readonly description?: ReactNode;
	/** Error text; marks the control `aria-invalid` and links the text with `aria-describedby`. */
	readonly error?: ReactNode;
	readonly required?: boolean;
	readonly disabled?: boolean;
	/** Id of the control; generated when omitted. */
	readonly id?: string;
	readonly children: ReactNode;
	readonly className?: string;
}

/**
 * Label, description and error around one kit control. `TextInput`, `TextArea`, `Select`,
 * `Combobox`, `Switch` and `Checkbox` read the field and wire `id`, `aria-describedby`,
 * `aria-invalid`, `required` and `disabled` themselves.
 */
export function Field({
	label,
	description,
	error,
	required = false,
	disabled = false,
	id,
	children,
	className,
}: FieldProps) {
	const auto = useId();
	const controlId = id ?? `rf-field-${auto}`;
	const hasDescription = description !== undefined && description !== null;
	const hasError = error !== undefined && error !== null && error !== false;
	const value: FieldContextValue = {
		id: controlId,
		labelId: `${controlId}-label`,
		describedBy: joinIds(
			hasDescription && `${controlId}-description`,
			hasError && `${controlId}-error`,
		),
		invalid: hasError,
		disabled,
		required,
	};
	return (
		<div className={cx("rf-field", className)} data-invalid={hasError || undefined}>
			<label className="rf-field-label" id={value.labelId} htmlFor={controlId}>
				{label}
			</label>
			{hasDescription ? (
				<p className="rf-field-description" id={`${controlId}-description`}>
					{description}
				</p>
			) : null}
			<FieldContext.Provider value={value}>{children}</FieldContext.Provider>
			{hasError ? (
				<p className="rf-field-error" id={`${controlId}-error`}>
					{error}
				</p>
			) : null}
		</div>
	);
}

export interface FieldControlInput {
	readonly id?: string | undefined;
	readonly "aria-describedby"?: string | undefined;
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly required?: boolean | undefined;
}

export interface FieldControl {
	readonly id: string | undefined;
	readonly labelId: string | undefined;
	readonly describedBy: string | undefined;
	readonly invalid: boolean;
	readonly disabled: boolean;
	readonly required: boolean;
}

/**
 * Merges a control's own props with the enclosing `Field`. Inside a field the field's id wins so
 * the label stays attached (set `id` on the `Field`); the other own props win over the field.
 */
export function useFieldControl(own: FieldControlInput): FieldControl {
	const field = useContext(FieldContext);
	return {
		id: field?.id ?? own.id,
		labelId: field?.labelId,
		describedBy: joinIds(own["aria-describedby"], field?.describedBy),
		invalid: own.invalid ?? field?.invalid ?? false,
		disabled: own.disabled ?? field?.disabled ?? false,
		required: own.required ?? field?.required ?? false,
	};
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	readonly size?: "sm" | "md";
	readonly invalid?: boolean;
	/** Called with the new value on every change, next to the native `onChange`. */
	readonly onValueChange?: (value: string) => void;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
	{ size = "md", invalid, onValueChange, onChange, className, type = "text", ...rest },
	ref,
) {
	const field = useFieldControl({
		id: rest.id,
		"aria-describedby": rest["aria-describedby"],
		invalid,
		disabled: rest.disabled,
		required: rest.required,
	});
	return (
		<input
			{...rest}
			ref={ref}
			type={type}
			id={field.id}
			className={cx("rf-input", `rf-input-${size}`, className)}
			aria-describedby={field.describedBy}
			aria-invalid={field.invalid || undefined}
			disabled={field.disabled}
			required={field.required}
			onChange={(event) => {
				onChange?.(event);
				onValueChange?.(event.target.value);
			}}
		/>
	);
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	readonly invalid?: boolean;
	readonly onValueChange?: (value: string) => void;
	/** Visible rows when empty; default 2. */
	readonly minRows?: number;
	/** Rows after which the area scrolls instead of growing. */
	readonly maxRows?: number;
}

const FALLBACK_LINE_HEIGHT = 20;

function px(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

/** Grows with its content between `minRows` and `maxRows`. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
	{ invalid, onValueChange, onChange, onInput, className, minRows = 2, maxRows, ...rest },
	ref,
) {
	const inner = useRef<HTMLTextAreaElement | null>(null);
	const field = useFieldControl({
		id: rest.id,
		"aria-describedby": rest["aria-describedby"],
		invalid,
		disabled: rest.disabled,
		required: rest.required,
	});

	const resize = (): void => {
		const node = inner.current;
		if (node === null) return;
		node.style.height = "auto";
		const content = node.scrollHeight;
		let height = content;
		if (maxRows !== undefined) {
			const style = getComputedStyle(node);
			const line = px(style.lineHeight) || FALLBACK_LINE_HEIGHT;
			const chrome =
				px(style.paddingTop) +
				px(style.paddingBottom) +
				px(style.borderTopWidth) +
				px(style.borderBottomWidth);
			height = Math.min(content, line * maxRows + chrome);
		}
		node.style.overflowY = height < content ? "auto" : "hidden";
		if (height > 0) node.style.height = `${height}px`;
	};
	const resizeRef = useRef(resize);
	resizeRef.current = resize;

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the controlled value changes
	useLayoutEffect(() => {
		resizeRef.current();
	}, [rest.value]);

	return (
		<textarea
			{...rest}
			ref={(node) => {
				inner.current = node;
				if (typeof ref === "function") ref(node);
				else if (ref !== null) ref.current = node;
			}}
			rows={minRows}
			id={field.id}
			className={cx("rf-textarea", className)}
			aria-describedby={field.describedBy}
			aria-invalid={field.invalid || undefined}
			disabled={field.disabled}
			required={field.required}
			onChange={(event) => {
				onChange?.(event);
				onValueChange?.(event.target.value);
			}}
			onInput={(event) => {
				onInput?.(event);
				resize();
			}}
		/>
	);
});
