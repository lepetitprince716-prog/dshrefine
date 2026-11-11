/**
 * Myers' O(ND) difference algorithm ("An O(ND) Difference Algorithm and Its Variations", 1986),
 * linear-space variant: a forward and a reverse search meet in the middle of an optimal edit
 * path, the problem is split at the meeting point and both halves are solved recursively.
 * Memory stays O(N + M); time is O((N + M) * D).
 *
 * Inputs are sequences of integer ids (interned lines or tokens) so comparisons are cheap.
 */

export interface SequenceDiff {
	/** 1 where the element of `a` is deleted. */
	readonly aChanged: Uint8Array;
	/** 1 where the element of `b` is inserted. */
	readonly bChanged: Uint8Array;
	/** Number of deleted plus inserted elements. */
	readonly distance: number;
}

type Sequence = ArrayLike<number>;

interface Split {
	readonly x: number;
	readonly y: number;
	/** Search depth at which the two searches met; each half needs at most `d` edits. */
	readonly d: number;
}

/**
 * Compute a minimal edit script between `a` and `b`. Returns `null` when the edit distance
 * exceeds `maxEditDistance`; the search gives up as soon as that is certain, so the cost of a
 * refusal is bounded by O((N + M) * maxEditDistance).
 */
export function diffSequences(
	a: Sequence,
	b: Sequence,
	maxEditDistance: number = Number.POSITIVE_INFINITY,
): SequenceDiff | null {
	const aChanged = new Uint8Array(a.length);
	const bChanged = new Uint8Array(b.length);
	const solved = compare({ a, b, aChanged, bChanged }, 0, a.length, 0, b.length, maxEditDistance);
	if (!solved) return null;
	let distance = 0;
	for (const flag of aChanged) distance += flag;
	for (const flag of bChanged) distance += flag;
	return distance > maxEditDistance ? null : { aChanged, bChanged, distance };
}

interface Work {
	readonly a: Sequence;
	readonly b: Sequence;
	readonly aChanged: Uint8Array;
	readonly bChanged: Uint8Array;
}

function compare(
	work: Work,
	aLoIn: number,
	aHiIn: number,
	bLoIn: number,
	bHiIn: number,
	limit: number,
): boolean {
	const { a, b } = work;
	let aLo = aLoIn;
	let aHi = aHiIn;
	let bLo = bLoIn;
	let bHi = bHiIn;
	while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) {
		aLo++;
		bLo++;
	}
	while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) {
		aHi--;
		bHi--;
	}
	if (aLo === aHi || bLo === bHi) {
		if (aHi - aLo + (bHi - bLo) > limit) return false;
		work.aChanged.fill(1, aLo, aHi);
		work.bChanged.fill(1, bLo, bHi);
		return true;
	}
	const split = bisect(work, aLo, aHi, bLo, bHi, limit);
	if (split === null) return false;
	// Each half of an optimal path found at depth d needs at most d edits; 2d is a safe cap.
	const halfLimit = 2 * split.d;
	return (
		compare(work, aLo, aLo + split.x, bLo, bLo + split.y, halfLimit) &&
		compare(work, aLo + split.x, aHi, bLo + split.y, bHi, halfLimit)
	);
}

/**
 * Find a point on an optimal edit path of the box `a[aLo, aHi) x b[bLo, bHi)` (both non-empty,
 * first and last elements differ). Diagonal k holds points with x - y = k. `forward[k]` is the
 * furthest x reached from the top-left, `reverse[k]` the furthest distance travelled back from
 * the bottom-right on reverse diagonal k (which is forward diagonal delta - k).
 */
function bisect(
	work: Work,
	aLo: number,
	aHi: number,
	bLo: number,
	bHi: number,
	limit: number,
): Split | null {
	const { a, b } = work;
	const n = aHi - aLo;
	const m = bHi - bLo;
	const delta = n - m;
	const deltaIsOdd = (delta & 1) !== 0;
	const maxD = Math.min(Math.ceil((n + m) / 2), Math.ceil(limit / 2));
	const offset = maxD + 1;
	const size = 2 * maxD + 3;
	const forward = new Int32Array(size).fill(-1);
	const reverse = new Int32Array(size).fill(-1);
	forward[offset + 1] = 0;
	reverse[offset + 1] = 0;
	// Diagonals that ran off the box edge are skipped on later rounds (start/end trims).
	let forwardStart = 0;
	let forwardEnd = 0;
	let reverseStart = 0;
	let reverseEnd = 0;

	for (let d = 0; d <= maxD; d++) {
		for (let k = -d + forwardStart; k <= d - forwardEnd; k += 2) {
			const i = offset + k;
			const below = forward[i - 1] as number;
			const above = forward[i + 1] as number;
			let x = k === -d || (k !== d && below < above) ? above : below + 1;
			let y = x - k;
			while (x < n && y < m && a[aLo + x] === b[bLo + y]) {
				x++;
				y++;
			}
			forward[i] = x;
			if (x > n) forwardEnd += 2;
			else if (y > m) forwardStart += 2;
			else if (deltaIsOdd) {
				const j = offset + delta - k;
				if (j >= 0 && j < size) {
					const back = reverse[j] as number;
					// A reverse point that ran off the box is not a meeting point.
					if (back !== -1 && back <= n && back - (delta - k) <= m && x >= n - back) {
						return { x, y, d };
					}
				}
			}
		}
		for (let k = -d + reverseStart; k <= d - reverseEnd; k += 2) {
			const i = offset + k;
			const below = reverse[i - 1] as number;
			const above = reverse[i + 1] as number;
			let x = k === -d || (k !== d && below < above) ? above : below + 1;
			let y = x - k;
			while (x < n && y < m && a[aHi - 1 - x] === b[bHi - 1 - y]) {
				x++;
				y++;
			}
			reverse[i] = x;
			if (x > n) reverseEnd += 2;
			else if (y > m) reverseStart += 2;
			else if (!deltaIsOdd) {
				const j = offset + delta - k;
				if (j >= 0 && j < size) {
					const fx = forward[j] as number;
					if (fx !== -1) {
						const fy = fx - (delta - k);
						if (fx <= n && fy <= m && fx >= n - x) return { x: fx, y: fy, d };
					}
				}
			}
		}
	}
	return null;
}
