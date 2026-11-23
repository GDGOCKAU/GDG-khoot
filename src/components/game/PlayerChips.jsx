/* Lobby players (host screen and audience screen): newest first, never more than the space shows.
   When they don't all fit, the last chip is "+N" (how many are not shown), so the page never scrolls. */
import { useLayoutEffect, useRef, useState } from 'react';

export default function PlayerChips({ players, renderChip, empty }) {
  const ref = useRef(null);
  const newestFirst = [...players].reverse();
  const [shown, setShown] = useState(newestFirst.length);
  const [size, setSize] = useState(0);

  /* the space changed (window, phase) or players came and went: measure again from "all of them" */
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(() => setSize(box.clientHeight * 10000 + box.clientWidth));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { setShown(newestFirst.length); }, [newestFirst.length, size]);

  /* after each render: if anything (the "+N" chip included) sits below the box, show one fewer */
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || shown <= 0) return;
    const limit = box.clientHeight;
    const over = [...box.children].some((el) => el.offsetTop + el.offsetHeight > limit + 1);
    if (over) setShown((n) => Math.max(0, n - 1));
  });

  const hidden = Math.max(0, newestFirst.length - shown);
  return (
    <div className="pchips" ref={ref} aria-live="polite">
      {newestFirst.length ? newestFirst.slice(0, shown).map(renderChip) : empty}
      {hidden > 0 && <span className="pchip pchip-more" aria-label={`${hidden} more players`}>+{hidden}</span>}
    </div>
  );
}
