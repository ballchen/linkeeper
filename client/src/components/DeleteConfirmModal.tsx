import React, { useEffect } from 'react';
import './DeleteConfirmModal.css';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  urlTitle?: string;
  isLoading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  urlTitle,
  isLoading = false
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleConfirm = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isLoading) {
      onConfirm();
    }
  };

  const handleCancel = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div className="delete-modal-overlay" onClick={handleOverlayClick}>
      <div className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <div className="delete-modal-content">
          <h3 id="delete-modal-title">刪除這個連結？</h3>
          {urlTitle && (
            <p className="delete-modal-url-title">
              {urlTitle}
            </p>
          )}
          <p className="delete-modal-warning">
            此操作無法復原。
          </p>
        </div>

        <div className="delete-modal-actions">
          <button
            className="delete-modal-cancel"
            onClick={(e) => handleCancel(e)}
            disabled={isLoading}
          >
            取消
          </button>
          <button
            className="delete-modal-confirm"
            onClick={(e) => handleConfirm(e)}
            disabled={isLoading}
            autoFocus
          >
            {isLoading ? (
              <>
                <span className="delete-loading-spinner"></span>
                刪除中⋯
              </>
            ) : (
              '刪除'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
