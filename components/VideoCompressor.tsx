'use client'
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState, Suspense } from 'react';
import Dropzone from './Dropzone';
import { useSearchParams } from 'next/navigation';

const MAX_FILE_LENGTH = 60; // 60s

// 新增 SearchParamsWrapper 組件
const SearchParamsWrapper: React.FC<{ children: (componentId: string | null) => React.ReactNode }> = ({ children }) => {
  const searchParams = useSearchParams();
  const componentId = searchParams.get('componentId');
  return <>{children(componentId)}</>;
};

const VideoCompressorContent: React.FC<{ componentId: string | null }> = ({ componentId }) => {
  const t = useTranslations('VideoCompressor');
  const [inputVideo, setInputVideo] = useState<File | null>(null);
  const [outputVideo, setOutputVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [compressing, setCompressing] = useState<boolean>(false);
  const [handledFileList, setHandledFileList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionTime: number;
  } | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef<FFmpeg>();
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
      load();
    }
    return () => {
      // Cleanup URLs when component unmounts
      if (outputVideo) {
        URL.revokeObjectURL(outputVideo);
      }
    };
  }, []);

  const load = async () => {
    if (!ffmpegRef.current) return;

    const ffmpegInstance = ffmpegRef.current;

    try {
      ffmpegInstance.on('progress', ({ progress }) => {
        if (progress <= 1) {
          setProgress(Math.round(progress * 100));
        }
      });

      ffmpegInstance.on("log", ({ message }) => {
        setLogMessages(prev => [...prev, message]);
      });

      // Load FFmpeg using the built-in loading mechanism
      await ffmpegInstance.load({
        coreURL: '/0811-9/ffmpeg-core.js',
      });

      setLoaded(true);
      setError(null);
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      setError('Failed to load FFmpeg. Please refresh the page and try again.');
      setLoaded(false);
    }
  };

  const compress = async () => {
    if (!loaded) {
      setError('FFmpeg is not loaded. Please wait or refresh the page.');
      return;
    }

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !inputVideo) return;

    setCompressing(true);
    setError(null);
    setLogMessages([]);
    isCancelledRef.current = false; // 重置取消標誌
    
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    try {
      const startTime = Date.now();
      await ffmpeg.writeFile(inputFileName, await fetchFile(inputVideo));

      // 檢查是否被取消
      if (isCancelledRef.current) {
        throw new Error('Compression cancelled by user.');
      }

      // 根據檔案類型選擇不同的壓縮參數
      const isMovFile = inputVideo.name.toLowerCase().endsWith('.mov');
      
      if (isMovFile) {
        // MOV 檔案使用 QuickTime 相容的參數
        await ffmpeg.exec([
          '-i', inputFileName,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-tag:v', 'avc1',
          '-movflags', 'faststart',
          '-crf', '26',
          '-preset', 'medium',
          '-profile:v', 'baseline',
          '-level', '3.0',
          '-vf', 'scale=-2:720',
          '-r', '15',
          '-threads', '0',
          '-pix_fmt', 'yuv420p',
          '-progress', '-',
          '-v', '',
          '-y',
          outputFileName
        ]);
      } else {
        // 其他檔案使用原本的快速壓縮參數
        await ffmpeg.exec([
          '-i', inputFileName,
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-tag:v', 'avc1',
          '-movflags', 'faststart',
          '-crf', '26',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-vf', 'scale=-2:720',
          '-r', '15',
          '-threads', '0',
          '-x264opts', 'no-cabac:ref=0:weightp=0:8x8dct=0',
          '-progress', '-',
          '-v', '',
          '-y',
          outputFileName
        ]);
      }

      // 檢查是否被取消
      if (isCancelledRef.current) {
        throw new Error('Compression cancelled by user.');
      }

      const endTime = Date.now();
      const compressionTime = (endTime - startTime) / 1000; // 秒

      const data = await ffmpeg.readFile(outputFileName);
      if (!(data instanceof Uint8Array)) {
        throw new Error('Unexpected data type from FFmpeg');
      }

      // Cleanup previous URL if exists
      if (outputVideo) {
        URL.revokeObjectURL(outputVideo);
      }

      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutputVideo(url);

      // Calculate compression stats
      const originalSize = inputVideo.size;
      const compressedSize = data.byteLength;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      setCompressionStats({
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime
      });

      setHandledFileList(prev => [...prev, inputVideo.name]);
      window.parent.postMessage({
        type: 'VIDEO_COMPRESSED',
        componentId: componentId,
        file: new File([data], `${componentId}-${Date.now()}-compressed-video.mp4`, { type: 'video/mp4' }),
        filename: inputVideo.name,
        stats: {
          originalSize,
          compressedSize,
          compressionRatio,
          compressionTime
        }
      }, '*');
      setInputVideo(null);
      setProgress(0);
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Compression cancelled by user.') {
        setError('已取消壓縮');
        setCompressing(false);
        setInputVideo(null);
        setProgress(0);
        // 重新載入 FFmpeg 以準備下次使用
        await load();
        return;
      } else {
        console.error('Error compressing video:', error);
        setError('Failed to compress video. Please try again.');
        window.parent.postMessage({
          type: 'VIDEO_COMPRESSED_FAILED',
          componentId: componentId,
        }, '*');
        setInputVideo(null);
        setProgress(0);
        setCompressing(false);
        // 重新載入 FFmpeg 以準備下次使用
        await load();
      }
    } finally {
      setCompressing(false);
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      if (handledFileList.includes(file.name)) {
        return;
      }
      setHandledFileList(prev => [...prev, file.name]);
      // 直接傳送圖片
      window.parent.postMessage({
        type: 'IMAGE_SELECTED',
        componentId: componentId,
        file: new File([await file.arrayBuffer()], `${componentId}-${Date.now()}-${file.name}`, { type: file.type }),
        filename: file.name
      }, '*');
      setInputVideo(null);
    } else if (file.type.startsWith('video/')) {
      if (handledFileList.includes(file.name)) {
        return;
      }
      // 檢查影片長度
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const duration = video.duration;
        if (duration >= MAX_FILE_LENGTH + 1) {
          setError(`影片長度不能超過${MAX_FILE_LENGTH}秒`);
          console.log(`影片長度不能超過${MAX_FILE_LENGTH}秒`);
          window.parent.postMessage({
            type: 'VIDEO_LENGTH_EXCEEDED',
            componentId: componentId,
          }, '*');
          setInputVideo(null);
        } else {
          setInputVideo(file);
        }
        // 清理 video 元素
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        setError('無法讀取影片檔案');
        setInputVideo(null);
      };

      // 創建 blob URL 來讀取影片元數據
      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;
    } else {
      setError('只支援 mp4 影片或常見圖片格式');
      window.parent.postMessage({
        type: 'FILE_TYPE_ERROR',
        componentId: componentId,
      }, '*');
    }
  };

  useEffect(() => {
    if (inputVideo && inputVideo.type.startsWith('video/')) {
      compress();
    }
  }, [inputVideo]);

  const handleCancel = async () => {
    // 設置取消標誌
    isCancelledRef.current = true;
    
    // 嘗試終止 FFmpeg 操作
    if (ffmpegRef.current) {
      try {
        await ffmpegRef.current.terminate();
      } catch (error) {
        console.log('FFmpeg already terminated or not loaded');
      }
    }
    
    setCompressing(false);
    setProgress(0);
    setInputVideo(null);
    setError('已取消壓縮');
    
    window.parent.postMessage({
      type: 'VIDEO_COMPRESSED_CANCEL',
      componentId: componentId,
    }, '*');
    
    // 重新載入 FFmpeg
    await load();
  };

  return (
    <div className="h-full">
      {
        !compressing && <Dropzone
          onChange={handleFileChange}
          className="w-full h-full"
          fileExtension="mp4"
        />
      }
      {compressing && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            {/* 圓環進度條 */}
            <div className="relative w-6 h-6 mx-auto mb-4">
              <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 100 100">
                {/* 進度圓環 */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#6DC4EF"
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                  className="transition-all duration-300 ease-out"
                />
              </svg>
            </div>
            <p className="mb-4 text-center font-poppins text-xs text-[#171B1E] font-normal">
              {t('compressing')}...
            </p>
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg border border-[#B9BFC7] bg-white shadow-sm text-[#171B1E] text-center font-poppins text-xs leading-none font-medium"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const VideoCompressor: React.FC = () => {
  return (
    <Suspense>
      <SearchParamsWrapper>
        {(componentId) => <VideoCompressorContent componentId={componentId} />}
      </SearchParamsWrapper>
    </Suspense>
  );
};

export default VideoCompressor;