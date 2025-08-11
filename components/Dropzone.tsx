import { useTranslations } from 'next-intl';
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface DropzoneProps {
  onChange: (file: File) => void;
  className?: string;
  fileExtension?: string;
}

const Dropzone: React.FC<DropzoneProps> = ({ onChange, className = '', fileExtension = '*' }) => {
  const t = useTranslations('VideoCompressor');
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onChange(acceptedFiles[0]);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    },
    maxFiles: 1
  });

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 flex items-center justify-center
        ${isDragActive
          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
        } ${className}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 29 29" fill="none">
          <g clipPath="url(#clip0_19994_339648)">
            <path d="M19.1669 19.0095L14.5002 14.3428M14.5002 14.3428L9.83353 19.0095M14.5002 14.3428V24.8428M24.2885 21.7978C25.4264 21.1775 26.3253 20.1959 26.8434 19.0079C27.3614 17.8199 27.4691 16.4933 27.1494 15.2373C26.8298 13.9813 26.1009 12.8676 25.078 12.0719C24.055 11.2761 22.7962 10.8437 21.5002 10.8428H20.0302C19.6771 9.47695 19.0189 8.20889 18.1051 7.13399C17.1914 6.0591 16.0459 5.20533 14.7546 4.63688C13.4634 4.06843 12.0602 3.80009 10.6503 3.85203C9.2405 3.90398 7.86078 4.27485 6.6149 4.93678C5.36903 5.59871 4.28943 6.53446 3.45726 7.67368C2.62509 8.81291 2.062 10.126 1.81034 11.5141C1.55868 12.9023 1.62499 14.3295 2.00428 15.6883C2.38357 17.0472 3.06598 18.3023 4.0002 19.3595" stroke="#097DBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <defs>
            <clipPath id="clip0_19994_339648">
              <rect width="28" height="28" fill="white" transform="translate(0.5 0.34375)" />
            </clipPath>
          </defs>
        </svg>
        <p className="text-[#097DBB] text-center font-poppins text-xs font-normal leading-none mt-2">
          {t('upload')}
        </p>
      </div>
    </div>
  );
};

export default Dropzone; 