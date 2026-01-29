import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "./dialog";
import React from "react";

// Modal API compatible with your project, using Dialog primitives
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showClose?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showClose = true,
  className
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={className}>
      {title && <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>}
      {description && <DialogDescription>{description}</DialogDescription>}
      {children}
      {footer && <DialogFooter>{footer}</DialogFooter>}
      {showClose && <DialogClose />}
    </DialogContent>
  </Dialog>
);

export default Modal;
