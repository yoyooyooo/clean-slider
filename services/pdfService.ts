
import { PDFDocument, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { CropMargins, PdfDimensions, Mask } from '../types';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export const loadPdfDocument = async (file: File): Promise<ArrayBuffer> => {
  return await file.arrayBuffer();
};

export const getPdfPageCount = async (fileData: ArrayBuffer): Promise<number> => {
  const dataCopy = fileData.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
};

export const getPdfPageText = async (fileData: ArrayBuffer): Promise<string> => {
  try {
    const dataCopy = fileData.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    const maxPages = Math.min(pdf.numPages, 5);
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `Page ${i}: ${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text:", error);
    return "";
  }
};

export const getPageAsImage = async (fileData: ArrayBuffer, pageNumber: number): Promise<string> => {
    console.log(`[PdfService] Rendering page ${pageNumber} for AI analysis...`);
    const dataCopy = fileData.slice(0);
    const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
    const pdf = await loadingTask.promise;
    
    // Ensure page number is valid
    const safePageNumber = Math.max(1, Math.min(pageNumber, pdf.numPages));
    const page = await pdf.getPage(safePageNumber);
    
    // Optimize: Limit max dimension to 1280px for better clarity while using Flash model.
    // 1280px strikes a balance between detail (for small watermarks) and upload speed.
    const maxDimension = 1280;
    let viewport = page.getViewport({ scale: 1.0 });
    
    // Calculate scale to fit within maxDimension while maintaining aspect ratio
    const scale = Math.min(1.0, maxDimension / Math.max(viewport.width, viewport.height));
    
    // If the PDF page is naturally small, scale UP to ensure clarity, but cap at maxDimension
    let finalScale = scale;
    if (viewport.width < 600) {
        finalScale = 600 / viewport.width;
    }

    viewport = page.getViewport({ scale: finalScale });
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not get canvas context");

    await page.render({
        canvasContext: context,
        viewport: viewport
    } as any).promise;

    console.log(`[PdfService] Page rendered. Dimensions: ${canvas.width}x${canvas.height}`);
    
    // Use 0.75 quality to ensure text details are preserved for AI reading
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    return dataUrl.split(',')[1];
};

export const renderPageToCanvas = async (
  fileData: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement
): Promise<PdfDimensions> => {
  const dataCopy = fileData.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale: 1.5 });
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: canvas.getContext('2d')!,
    viewport: viewport,
  };

  await page.render(renderContext as any).promise;

  return {
    width: viewport.width,
    height: viewport.height,
  };
};

export const cropAndDownloadPdf = async (
  fileData: ArrayBuffer,
  margins: CropMargins,
  fileName: string
): Promise<void> => {
  const pdfDoc = await PDFDocument.load(fileData);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    
    const cropLeft = (margins.left / 100) * width;
    const cropRight = width - ((margins.right / 100) * width);
    const cropBottom = (margins.bottom / 100) * height;
    const cropTop = height - ((margins.top / 100) * height);
    
    page.setCropBox(cropLeft, cropBottom, cropRight - cropLeft, cropTop - cropBottom);
  });

  const pdfBytes = await pdfDoc.save();
  downloadPdfBlob(pdfBytes, `cleaned-${fileName}`);
};

export const modifyPdfWithMasks = async (
  fileData: ArrayBuffer,
  masks: Mask[],
  fileName: string
): Promise<void> => {
  const pdfDoc = await PDFDocument.load(fileData);
  const pages = pdfDoc.getPages();

  // Helper to convert hex to RGB with robust safety checks
  const hexToRgb = (hex: string | undefined) => {
    // Default to white if hex is invalid or undefined
    let safeHex = (typeof hex === 'string' && hex.startsWith('#')) ? hex : '#FFFFFF';
    
    // Handle short hex (#FFF)
    if (safeHex.length === 4) {
       safeHex = '#' + safeHex[1] + safeHex[1] + safeHex[2] + safeHex[2] + safeHex[3] + safeHex[3];
    }
    
    // Ensure length is correct, otherwise fallback
    if (safeHex.length !== 7) safeHex = '#FFFFFF';

    const r = parseInt(safeHex.slice(1, 3), 16) / 255;
    const g = parseInt(safeHex.slice(3, 5), 16) / 255;
    const b = parseInt(safeHex.slice(5, 7), 16) / 255;
    
    // Return valid numbers or 1 (white) if NaN
    return { 
        r: isNaN(r) ? 1 : r, 
        g: isNaN(g) ? 1 : g, 
        b: isNaN(b) ? 1 : b 
    };
  };

  // Iterate over all pages using the index
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // Filter masks: Include Global masks (pageIndex undefined) AND masks specific to this page index
    const pageMasks = masks.filter(m => m.pageIndex === undefined || m.pageIndex === i);

    for (const mask of pageMasks) {
        // Convert percentages to PDF coordinates
        const x = (mask.x / 100) * width;
        const w = (mask.width / 100) * width;
        const h = (mask.height / 100) * height;
        const y = height - ((mask.y / 100) * height) - h;

        if (mask.fillType !== 'solid' && mask.imageSnapshot) {
            // Embed the snapshot image
            try {
                const pngImage = await pdfDoc.embedPng(mask.imageSnapshot);
                page.drawImage(pngImage, {
                    x,
                    y,
                    width: w,
                    height: h,
                });
            } catch (e) {
                console.error("Failed to embed mask image, falling back to color", e);
                // Fallback
                const color = hexToRgb(mask.color);
                page.drawRectangle({
                    x, y, width: w, height: h,
                    color: rgb(color.r, color.g, color.b),
                });
            }
        } else {
            // Solid Color
            const color = hexToRgb(mask.color);
            page.drawRectangle({
                x,
                y,
                width: w,
                height: h,
                color: rgb(color.r, color.g, color.b),
            });
        }
    }
  }

  const pdfBytes = await pdfDoc.save();
  downloadPdfBlob(pdfBytes, `patched-${fileName}`);
}

const downloadPdfBlob = (bytes: Uint8Array, name: string) => {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
