import classNames from 'classnames/bind';
import styles from './Button.module.scss';

const cx = classNames.bind(styles);

interface ButtonProps {
  content: string;
  submit?: boolean;
  disabled?: boolean;
  isGray?: boolean;
  isSub?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}

export function Button({
  content,
  submit,
  disabled,
  isGray,
  isSub,
  isLoading,
  onClick,
}: ButtonProps) {
  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <button
      type={submit ? 'submit' : 'button'}
      className={cx('button', { isGray }, { isSub })}
      disabled={disabled}
      onClick={handleClick}>
      {isLoading ? <div className={cx('loader')} /> : content}
    </button>
  );
}
