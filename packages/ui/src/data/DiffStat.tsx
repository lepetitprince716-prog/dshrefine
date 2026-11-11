export interface DiffStatProps {
	readonly added: number;
	readonly removed: number;
	/** Localized accessible text, for example "12 additions, 3 deletions". */
	readonly label?: string;
	readonly className?: string;
}

/** `+12 −3` chip; colour is never the only signal, the sign carries the meaning. */
export function DiffStat({ added, removed, label, className }: DiffStatProps) {
	const classes = className === undefined ? "rf-diffstat" : `rf-diffstat ${className}`;
	const parts = (
		<>
			<span className="rf-diffstat-added">+{added}</span>
			<span className="rf-diffstat-removed">
				{"−"}
				{removed}
			</span>
		</>
	);
	if (label === undefined) return <span className={classes}>{parts}</span>;
	return (
		<span className={classes} role="img" aria-label={label}>
			{parts}
		</span>
	);
}
