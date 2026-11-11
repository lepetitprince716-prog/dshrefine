import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useFieldControl } from "./field.tsx";
import { ChevronDownGlyph } from "./glyphs.tsx";
import { useOverlayLayer } from "./overlay-layer.tsx";
import { cx, edgeEnabled, nextEnabled } from "./util.ts";

export interface SelectOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly disabled?: boolean;
}

export interface SelectGroup {
	readonly label: string;
	readonly options: readonly SelectOption[];
}

/** Options, optionally grouped (for example local and remote branches). */
export type SelectItems = readonly (SelectOption | SelectGroup)[];

interface Section {
	readonly label: string | undefined;
	readonly options: readonly { readonly option: SelectOption; readonly index: number }[];
}

interface Flattened {
	readonly sections: readonly Section[];
	readonly options: readonly SelectOption[];
}

const isGroup = (item: SelectOption | SelectGroup): item is SelectGroup => "options" in item;

function flatten(items: SelectItems, keep: (option: SelectOption) => boolean): Flattened {
	const sections: Section[] = [];
	const options: SelectOption[] = [];
	let loose: { option: SelectOption; index: number }[] = [];
	const take = (option: SelectOption) => {
		const entry = { option, index: options.length };
		options.push(option);
		return entry;
	};
	for (const item of items) {
		if (!isGroup(item)) {
			if (keep(item)) loose.push(take(item));
			continue;
		}
		if (loose.length > 0) sections.push({ label: undefined, options: loose });
		loose = [];
		const grouped = item.options.filter(keep).map(take);
		if (grouped.length > 0) sections.push({ label: item.label, options: grouped });
	}
	if (loose.length > 0) sections.push({ label: undefined, options: loose });
	return { sections, options };
}

const keepAll = () => true;

/** Case-insensitive substring match on label and value; the default `Combobox` filter. */
export function matchOption(option: SelectOption, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (needle === "") return true;
	return option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle);
}

const optionId = (listId: string, index: number) => `${listId}-option-${index}`;

interface ListboxProps {
	readonly id: string;
	readonly label: string | undefined;
	readonly flat: Flattened;
	readonly active: number;
	readonly selected: string | null;
	readonly emptyLabel: string | undefined;
	readonly onPick: (option: SelectOption) => void;
	readonly onHover: (index: number) => void;
}

function Listbox({ id, label, flat, active, selected, emptyLabel, onPick, onHover }: ListboxProps) {
	useEffect(() => {
		document.getElementById(optionId(id, active))?.scrollIntoView?.({ block: "nearest" });
	}, [id, active]);
	const renderOption = ({ option, index }: Section["options"][number]) => (
		// biome-ignore lint/a11y/useKeyWithClickEvents: options are driven from the combobox through aria-activedescendant
		<div
			key={`${index}:${option.value}`}
			id={optionId(id, index)}
			role="option"
			tabIndex={-1}
			className="rf-option"
			aria-selected={option.value === selected}
			aria-disabled={option.disabled || undefined}
			data-active={index === active || undefined}
			onMouseDown={(event) => event.preventDefault()}
			onMouseMove={() => {
				if (index !== active && option.disabled !== true) onHover(index);
			}}
			onClick={() => {
				if (option.disabled !== true) onPick(option);
			}}
		>
			<span className="rf-option-label">{option.label}</span>
			{option.description === undefined ? null : (
				<span className="rf-option-description">{option.description}</span>
			)}
		</div>
	);
	return (
		<div id={id} role="listbox" aria-label={label} className="rf-listbox">
			{flat.sections.map((section, sectionIndex) =>
				section.label === undefined ? (
					section.options.map(renderOption)
				) : (
					// biome-ignore lint/a11y/useSemanticElements: an ARIA listbox group has no native element; fieldset is not allowed inside role="listbox"
					<div
						key={`group-${section.label}`}
						role="group"
						aria-labelledby={`${id}-group-${sectionIndex}`}
						className="rf-listbox-group"
					>
						<div
							id={`${id}-group-${sectionIndex}`}
							className="rf-listbox-group-label"
							role="presentation"
						>
							{section.label}
						</div>
						{section.options.map(renderOption)}
					</div>
				),
			)}
			{flat.options.length === 0 && emptyLabel !== undefined ? (
				<div className="rf-listbox-empty">{emptyLabel}</div>
			) : null}
		</div>
	);
}

type NavKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

function navigate(key: string, disabled: readonly boolean[], active: number): number | null {
	switch (key as NavKey) {
		case "ArrowDown":
			return active < 0 ? edgeEnabled(disabled, 1) : nextEnabled(disabled, active, 1);
		case "ArrowUp":
			return active < 0 ? edgeEnabled(disabled, -1) : nextEnabled(disabled, active, -1);
		case "Home":
			return edgeEnabled(disabled, 1);
		case "End":
			return edgeEnabled(disabled, -1);
		default:
			return null;
	}
}

interface ChoiceProps {
	readonly value: string | null;
	readonly onChange: (value: string) => void;
	readonly options: SelectItems;
	readonly placeholder?: string;
	/** Accessible name when there is no enclosing `Field`. */
	readonly "aria-label"?: string;
	readonly "aria-describedby"?: string;
	/** Accessible name of the popup list. */
	readonly listLabel?: string;
	readonly invalid?: boolean;
	readonly disabled?: boolean;
	readonly id?: string;
	readonly size?: "sm" | "md";
	readonly className?: string;
}

export type SelectProps = ChoiceProps;

/**
 * Select-only combobox: a button that opens an anchored listbox. Focus stays on the button;
 * arrows, Home and End move the active option, Enter or Space picks it, Escape closes, and a
 * printed character jumps to the next option starting with it.
 */
export function Select({
	value,
	onChange,
	options,
	placeholder,
	"aria-label": ariaLabel,
	"aria-describedby": describedBy,
	listLabel,
	invalid,
	disabled,
	id,
	size = "md",
	className,
}: SelectProps) {
	const auto = useId();
	const listId = `rf-listbox-${auto}`;
	const trigger = useRef<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const field = useFieldControl({ id, "aria-describedby": describedBy, invalid, disabled });
	const flat = flatten(options, keepAll);
	const disabledFlags = flat.options.map((option) => option.disabled === true);
	const selectedIndex = flat.options.findIndex((option) => option.value === value);
	const selected = flat.options[selectedIndex];

	const openList = (): void => {
		setActive(
			selectedIndex >= 0 && disabledFlags[selectedIndex] === false
				? selectedIndex
				: edgeEnabled(disabledFlags, 1),
		);
		setOpen(true);
	};
	const pick = (option: SelectOption): void => {
		setOpen(false);
		trigger.current?.focus();
		if (option.value !== value) onChange(option.value);
	};

	useOverlayLayer(open, {
		kind: "anchored",
		anchor: () => trigger.current,
		placement: "bottom-start",
		matchAnchorWidth: true,
		onClose: () => setOpen(false),
		render: () => (
			<Listbox
				id={listId}
				label={listLabel ?? ariaLabel}
				flat={flat}
				active={active}
				selected={value}
				emptyLabel={undefined}
				onPick={pick}
				onHover={setActive}
			/>
		),
	});

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
		if (!open) {
			if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
				event.preventDefault();
				openList();
			}
			return;
		}
		const next = navigate(event.key, disabledFlags, active);
		if (next !== null) {
			event.preventDefault();
			if (next >= 0) setActive(next);
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			const option = flat.options[active];
			if (option !== undefined && option.disabled !== true) pick(option);
			return;
		}
		if (event.key === "Tab") {
			setOpen(false);
			return;
		}
		if (event.key.length === 1) {
			const char = event.key.toLowerCase();
			const count = flat.options.length;
			for (let step = 1; step <= count; step++) {
				const index = (active + step) % count;
				const option = flat.options[index];
				if (
					option !== undefined &&
					option.disabled !== true &&
					option.label.toLowerCase().startsWith(char)
				) {
					setActive(index);
					break;
				}
			}
		}
	};

	return (
		<button
			ref={trigger}
			type="button"
			role="combobox"
			id={field.id}
			className={cx("rf-select", `rf-select-${size}`, className)}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={open ? listId : undefined}
			aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
			aria-label={ariaLabel}
			aria-labelledby={ariaLabel === undefined ? field.labelId : undefined}
			aria-describedby={field.describedBy}
			aria-invalid={field.invalid || undefined}
			disabled={field.disabled}
			onClick={() => (open ? setOpen(false) : openList())}
			onKeyDown={onKeyDown}
		>
			<span
				className="rf-select-value"
				data-placeholder={selected === undefined || undefined}
				// The value truncates in a narrow trigger; hover shows the whole label.
				title={selected?.label}
			>
				{selected?.label ?? placeholder}
			</span>
			<span className="rf-select-chevron" aria-hidden="true">
				<ChevronDownGlyph />
			</span>
		</button>
	);
}

export interface ComboboxProps extends ChoiceProps {
	/** Shown in the list when the query matches nothing. */
	readonly emptyLabel?: string;
	/** Replaces `matchOption`. */
	readonly filter?: (option: SelectOption, query: string) => boolean;
	/**
	 * Focus the input once it mounts, for a combobox that replaces a loading state after its
	 * dialog has already placed focus. Runs after the dialog's own autofocus.
	 */
	readonly autoFocus?: boolean;
}

/**
 * Editable combobox with list autocomplete: typing filters the options (groups without matches
 * disappear), arrows move the active option, Enter picks it, Escape closes the list.
 */
export function Combobox({
	value,
	onChange,
	options,
	placeholder,
	"aria-label": ariaLabel,
	"aria-describedby": describedBy,
	listLabel,
	invalid,
	disabled,
	id,
	size = "md",
	className,
	emptyLabel,
	filter = matchOption,
	autoFocus = false,
}: ComboboxProps) {
	const auto = useId();
	const listId = `rf-listbox-${auto}`;
	const input = useRef<HTMLInputElement | null>(null);
	useEffect(() => {
		if (autoFocus) input.current?.focus();
	}, [autoFocus]);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(-1);
	const field = useFieldControl({ id, "aria-describedby": describedBy, invalid, disabled });
	const all = flatten(options, keepAll);
	const selected = all.options.find((option) => option.value === value);
	const flat = open ? flatten(options, (option) => filter(option, query)) : all;
	const disabledFlags = flat.options.map((option) => option.disabled === true);

	const show = (nextQuery: string): void => {
		const filtered = flatten(options, (option) => filter(option, nextQuery));
		const flags = filtered.options.map((option) => option.disabled === true);
		const current = filtered.options.findIndex((option) => option.value === value);
		setQuery(nextQuery);
		setActive(current >= 0 && flags[current] === false ? current : edgeEnabled(flags, 1));
		setOpen(true);
	};
	const pick = (option: SelectOption): void => {
		setOpen(false);
		setQuery("");
		input.current?.focus();
		if (option.value !== value) onChange(option.value);
	};

	useOverlayLayer(open, {
		kind: "anchored",
		anchor: () => input.current,
		placement: "bottom-start",
		matchAnchorWidth: true,
		onClose: () => setOpen(false),
		render: () => (
			<Listbox
				id={listId}
				label={listLabel ?? ariaLabel}
				flat={flat}
				active={active}
				selected={value}
				emptyLabel={emptyLabel}
				onPick={pick}
				onHover={setActive}
			/>
		),
	});

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (!open) {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				show("");
			}
			return;
		}
		const next = navigate(event.key, disabledFlags, active);
		if (next !== null) {
			event.preventDefault();
			if (next >= 0) setActive(next);
			return;
		}
		if (event.key === "Enter") {
			const option = flat.options[active];
			if (option === undefined || option.disabled === true) return;
			event.preventDefault();
			pick(option);
		}
	};

	return (
		<input
			ref={input}
			type="text"
			role="combobox"
			id={field.id}
			className={cx("rf-input", `rf-input-${size}`, "rf-combobox", className)}
			autoComplete="off"
			spellCheck={false}
			placeholder={placeholder}
			value={open ? query : (selected?.label ?? "")}
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={open ? listId : undefined}
			aria-activedescendant={open && active >= 0 ? optionId(listId, active) : undefined}
			aria-label={ariaLabel}
			aria-describedby={field.describedBy}
			aria-invalid={field.invalid || undefined}
			disabled={field.disabled}
			onChange={(event) => show(event.target.value)}
			// Keyboard focus keeps the selected label in the input; selecting it makes typing start a
			// new query instead of appending to the label. A click opens the full list instead.
			onFocus={(event) => event.currentTarget.select()}
			onClick={() => {
				if (!open) show("");
			}}
			onKeyDown={onKeyDown}
			onBlur={() => setOpen(false)}
		/>
	);
}
