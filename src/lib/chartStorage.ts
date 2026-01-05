/**
 * Chart Storage Utility - Capture, store, and download Kundali charts
 * Following ARCHITECTURE.md guidelines
 */

import html2canvas from 'html2canvas';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from './firebase';

/**
 * Capture a DOM element as a PNG blob
 */
export async function captureChartAsPng(elementId: string): Promise<Blob> {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element with id '${elementId}' not found`);
    }

    const canvas = await html2canvas(element, {
        backgroundColor: '#030308',  // Match app background
        scale: 2,  // High resolution
        useCORS: true,
        logging: false,
    });

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to convert canvas to blob'));
            }
        }, 'image/png', 0.95);
    });
}

/**
 * Upload chart PNG to Firebase Storage
 */
export async function uploadChartToStorage(
    userId: string,
    blob: Blob,
    chartType: 'birth' | 'navamsa' | 'transit' = 'birth'
): Promise<string> {
    const timestamp = Date.now();
    const path = `users/${userId}/charts/${chartType}_chart_${timestamp}.png`;
    const thumbPath = `users/${userId}/charts/${chartType}_thumb_${timestamp}.png`;

    // Generate thumbnail blob from full blob (actually we need the element for html2canvas thumbnail)
    // For simplicity, we'll just upload the same blob for now or skip thumbnail if not provided

    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, {
        contentType: 'image/png',
        customMetadata: { userId, chartType, generatedAt: new Date().toISOString() },
    });

    const url = await getDownloadURL(storageRef);

    // Update Firestore with chart URL
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        chartUrl: url,
        chartGeneratedAt: new Date(),
    });

    return url;
}

/**
 * Capture chart and upload to storage in one step (including thumbnail)
 */
export async function captureAndUploadChart(
    elementId: string,
    userId: string,
    chartType: 'birth' | 'navamsa' | 'transit' = 'birth'
): Promise<string> {
    // 1. Capture full chart
    const fullBlob = await captureChartAsPng(elementId);

    // 2. Capture thumbnail
    const thumbDataUrl = await generateThumbnail(elementId);
    const thumbResponse = await fetch(thumbDataUrl);
    const thumbBlob = await thumbResponse.blob();

    // 3. Upload full chart
    const fullUrl = await uploadChartToStorage(userId, fullBlob, chartType);

    // 4. Upload thumbnail
    const timestamp = Date.now();
    const thumbPath = `users/${userId}/charts/${chartType}_thumb_${timestamp}.png`;
    const thumbRef = ref(storage, thumbPath);
    await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/png' });
    const thumbUrl = await getDownloadURL(thumbRef);

    // 5. Update Firestore with both
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        chartUrl: fullUrl,
        thumbnailUrl: thumbUrl,
        chartGeneratedAt: new Date(),
    });

    return fullUrl;
}

/**
 * Download chart as PNG to user's device
 */
export function downloadChart(elementId: string, filename: string = 'kundali-chart.png'): void {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id '${elementId}' not found`);
        return;
    }

    html2canvas(element, {
        backgroundColor: '#030308',
        scale: 2,
        useCORS: true,
        logging: false,
    }).then((canvas) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

/**
 * Generate chart thumbnail (smaller version for lists)
 */
export async function generateThumbnail(elementId: string): Promise<string> {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element with id '${elementId}' not found`);
    }

    const canvas = await html2canvas(element, {
        backgroundColor: '#030308',
        scale: 0.5,  // Smaller scale for thumbnail
        useCORS: true,
        logging: false,
    });

    return canvas.toDataURL('image/png', 0.7);
}
