import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tourSteps } from './steps';

type Position = { x: number; y: number; width: number; height: number };
type Props = {
  index: number;
  page: string;
  onAdvance: (skipGroup: boolean) => void;
  onClose: () => void;
};

export function OnboardingTour({ index, page, onAdvance, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const step = tourSteps[index];
  const [position, setPosition] = useState<{ target: Position; left: number; top: number; width: number }>();

  useLayoutEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    modal.showModal();
    return () => modal.close();
  }, []);

  useLayoutEffect(() => {
    setPosition(undefined);
    if (page !== step.page) return;
    let frame = 0;
    let lastTarget: HTMLElement | null = null;
    const observer = new ResizeObserver(schedule);
    if (box.current) observer.observe(box.current);

    function measure() {
      const target = document.querySelector<HTMLElement>('[data-tour="' + step.target + '"]');
      if (!target || !box.current) return;
      if (target !== lastTarget) {
        if (lastTarget) observer.unobserve(lastTarget);
        lastTarget = target;
        observer.observe(target);
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const rect = target.getBoundingClientRect();
      const x = Math.max(4, rect.left - 6);
      const y = Math.max(4, rect.top - 6);
      const right = Math.min(w - 4, rect.right + 6);
      const bottom = Math.min(h - 4, rect.bottom + 6);
      const width = Math.min(360, w - 24);
      const height = box.current.offsetHeight;
      const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

      let left = clamp(x, 12, w - width - 12);
      let top = bottom + 12;
      if (right + 12 + width <= w - 12) {
        left = right + 12;
        top = y;
      } else if (x - 12 - width >= 12) {
        left = x - 12 - width;
        top = y;
      } else if (top + height > h - 12) {
        top = y - height - 12;
        if (top < 12) top = h - height - 12;
      }

      setPosition({ target: { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) },
        left, top: clamp(top, 12, h - height - 12), width });
    }

    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    const mutations = new MutationObserver(schedule);
    const workspace = document.querySelector('.shell');
    if (workspace) mutations.observe(workspace, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    title.current?.focus({ preventScroll: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [index, page, step.page, step.target]);

  return <dialog ref={dialog} className="tour-overlay" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <svg className="tour-shade" width="100%" height="100%" aria-hidden="true">
      <defs><mask id={titleId + '-spotlight'}>
        <rect width="100%" height="100%" fill="white"/>
        {position && <rect {...position.target} rx="12" fill="black"/>}
      </mask></defs>
      <rect width="100%" height="100%" fill="rgb(9 15 28 / 74%)" mask={'url(#' + titleId + '-spotlight)'}/>
      {position && <rect {...position.target} rx="12" className="tour-ring"/>}
    </svg>
    <section ref={box} className="tour-popover" style={position && {
      left: position.left, top: position.top, width: position.width,
    }}>
      <div className="tour-heading">
        <span className="tour-eyebrow"><Compass size={17}/> Rehber turu · {index + 1}/{tourSteps.length}</span>
        <Button type="button" variant="ghost" size="icon" aria-label="Turu kapat" onClick={onClose}><X size={18}/></Button>
      </div>
      <h2 ref={title} tabIndex={-1} id={titleId}>{step.title}</h2>
      <p id={descriptionId}>{step.description}</p>
      <div className="tour-actions">
        <Button type="button" variant="outline" onClick={() => onAdvance(true)}>Atla</Button>
        <Button type="button" onClick={() => onAdvance(false)}>
          {index === tourSteps.length - 1 ? 'Bitir' : 'İleri'}<ArrowRight size={17}/>
        </Button>
      </div>
    </section>
  </dialog>;
}
