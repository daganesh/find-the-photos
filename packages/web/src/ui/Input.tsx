import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label?: string;
  id?: string;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true; rows?: number };

type Props = InputProps | TextareaProps;

/**
 * A labelled text field — wraps the repo's bare `<input>` + `.field-label`
 * pattern into a single composable component.
 */
export function Input(props: Props) {
  const { label, multiline, id, ...rest } = props;
  const fieldId = id ?? (label ? `ftp-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      {multiline ? (
        <textarea id={fieldId} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input id={fieldId} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}
