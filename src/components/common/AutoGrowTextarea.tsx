import React, { useLayoutEffect, useRef } from 'react';

// Browsers that size a field to its text (field-sizing) do it in CSS; elsewhere it's done here.
const sizesItself = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

type AutoGrowTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  ref?: React.Ref<HTMLTextAreaElement>;
};

/** A text field one line tall that grows a line at a time as the text wraps. */
export const AutoGrowTextarea: React.FC<AutoGrowTextareaProps> = ({
  className = '',
  ref,
  ...props
}) => {
  const own = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = own.current;
    if (!el || sizesItself) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [props.value]);

  return (
    <textarea
      rows={1}
      {...props}
      ref={(el) => {
        own.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      className={`form-control is-growing ${className}`.trim()}
    />
  );
};
