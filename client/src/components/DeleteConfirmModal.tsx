import React from 'react';
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
      <div className="delete-modal">
        <div className="delete-modal-header">
          <h3>確認刪除</h3>
          {!isLoading && (
            <button className="delete-modal-close" onClick={(e) => handleCancel(e)}>
              ×
            </button>
          )}
        </div>
        
        <div className="delete-modal-content">
          <div className="delete-modal-icon">🗑️</div>
          <p className="delete-modal-message">
            確定要刪除這個連結嗎？
          </p>
          {urlTitle && (
            <p className="delete-modal-url-title">
              "{urlTitle}"
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
          >
            {isLoading ? (
              <>
                <span className="delete-loading-spinner"></span>
                刪除中...
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