import React, { forwardRef } from 'react';
import classNames from 'classnames/bind';
import styles from './Select.module.scss';

const cx = classNames.bind(styles);

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  placeholder: string;
  labelContent?: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  loading?: boolean;
  errMsg?: string;
  onChange: (value: string) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      id,
      placeholder,
      labelContent,
      value,
      options,
      disabled,
      loading,
      errMsg,
      onChange,
    }: SelectProps,
    ref
  ) {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    };

    return (
      <fieldset className={cx('selectField')}>
        {labelContent && (
          <div className={cx('labelContainer')}>
            <label htmlFor={id}>{labelContent}</label>
            {errMsg && <p className={cx('errorMsg')}>{errMsg}</p>}
          </div>
        )}
        <div className={cx('selectWrapper')}>
          <select
            id={id}
            ref={ref}
            value={value}
            onChange={handleChange}
            disabled={disabled || loading}
            className={cx('select', { hasError: errMsg, hasValue: value })}
          >
            <option value="" disabled>
              {loading ? '불러오는 중...' : placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className={cx('selectIcon')}>
            {loading ? (
              <div className={cx('loader')} />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      </fieldset>
    );
  }
);
