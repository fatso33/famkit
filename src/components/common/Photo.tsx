import React from 'react';
import { usePhoto } from '../../hooks/usePhoto';

interface PhotoProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  /** A photo field's value: a photo the record holds, `photo:<id>`, or '' for none. */
  value: string | undefined;
  alt: string;
  /** Drawn when there's no photo: none, or one that can't be had now. */
  fallback: React.ReactNode;
  /** Drawn while the photo is on its way: a soft stand-in, unless given. */
  standIn?: React.ReactNode;
  /** Shows the stand-in as if waiting (a quick-start copy whose photos are still coming). */
  waiting?: boolean;
}

/**
 * A recipe photo, wherever it's kept (hooks/usePhoto): the photo once it's here, a stand-in while
 * it's on its way, else `fallback`.
 */
export const Photo: React.FC<PhotoProps> = ({
  value,
  alt,
  fallback,
  standIn = <span className="photo-pending" />,
  waiting = false,
  ...img
}) => {
  const photo = usePhoto(value);
  if (photo.src) return <img src={photo.src} alt={alt} {...img} />;
  return <>{photo.pending || waiting ? standIn : fallback}</>;
};
