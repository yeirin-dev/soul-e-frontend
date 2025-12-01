import React, { forwardRef, useState } from 'react';
import classNames from 'classnames/bind';
import styles from './InputField.module.scss';

const cx = classNames.bind(styles);

interface InputFieldProps {
  type?: 'text' | 'number' | 'password';
  id?: string;
  placeholder: string;
  labelContent?: string;
  value?: string;
  maxLength?: number;
  readonly?: boolean;
  inputMode?: 'text' | 'search' | 'email' | 'tel' | 'url' | 'none' | 'numeric' | 'decimal';
  errMsg?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pattern?: RegExp;
  minLength?: number;
  onValidityChange?: (isValid: boolean) => void;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField(
    {
      type = 'text',
      id,
      placeholder,
      labelContent,
      value: initialValue,
      maxLength,
      readonly,
      inputMode,
      errMsg,
      onChange,
      pattern,
      minLength,
      onValidityChange,
    }: InputFieldProps,
    ref
  ) {
    const [value, setValue] = useState(initialValue ?? '');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      if (onChange) onChange(e);
      
      if (onValidityChange) {
        let isValid = true;
        if (minLength && newValue.length < minLength) isValid = false;
        if (pattern && !pattern.test(newValue)) isValid = false;
        onValidityChange(isValid);
      }
    };

    return (
      <fieldset className={cx('inputField')}>
        {labelContent && (
          <div className={cx('labelContainer')}>
            <label htmlFor={id}>{labelContent}</label>
            {errMsg && <p>{errMsg}</p>}
          </div>
        )}
        <input
          type={type}
          inputMode={inputMode}
          id={id}
          ref={ref}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={readonly}
          className={cx('input', { errMsg })}
          spellCheck={false}
          autoComplete='off'
        />
      </fieldset>
    );
  }
);
