import React from 'react';
import { GripVertical } from 'lucide-react';
import { dragToReorder } from '../../hooks/dragToReorder';

interface DragGripProps {
  /** Puts the dragged item (`id`) in the place of the one it was let go over (`targetId`). */
  onDrop: (id: string, targetId: string) => void;
}

/**
 * The grip on a lifted row or step's right edge: pressed and dragged, it carries the item to a
 * new place. Touch only moves the item from here, so the rest of the item still scrolls the page.
 * Hidden from screen readers and the keyboard, which have the item's up and down keys instead.
 */
export const DragGrip: React.FC<DragGripProps> = ({ onDrop }) => (
  <span
    className="drag-grip"
    aria-hidden="true"
    onPointerDown={(e) =>
      dragToReorder(e, e.currentTarget.closest<HTMLElement>('[data-motion-id]'), onDrop)
    }
  >
    <GripVertical size="1.15rem" strokeWidth={2.2} />
  </span>
);
