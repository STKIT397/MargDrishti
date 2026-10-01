/**
 * MargDrishti — Modular Image Authenticity Verification Service
 * Pre-validation gate executed before YOLO11 road damage inference.
 *
 * Designed to connect to a future deep learning model (e.g. synthetic image artifact detector / GAN/Diffusion classifier).
 * Per MargDrishti architectural integrity rules:
 * - Simplistic hacks (e.g. EXIF existence, JPG headers) are NOT used as they are scientifically unreliable.
 * - When no live backend detector model is connected, the service explicitly reports
 *   "Image authenticity verification service unavailable" without fabricating fake confidence scores.
 */

export const AUTHENTICITY_STATUS = {
  LIKELY_REAL: 'LIKELY_REAL',
  LIKELY_AI_GENERATED: 'LIKELY_AI_GENERATED',
  UNCERTAIN: 'UNCERTAIN',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

class ImageAuthenticityServiceManager {
  constructor() {
    // Future backend endpoint (Spring Boot / Python FastAPI inference gateway)
    this.apiEndpoint = null;
    this.validationPolicy = {
      allowUncertain: true,
      blockAiGenerated: true
    };
    this._simulatedMode = null; // null | 'LIKELY_REAL' | 'LIKELY_AI_GENERATED' | 'UNCERTAIN'
  }

  /**
   * Configure backend endpoint for future real detector connection
   * @param {string} endpointUrl
   */
  setApiEndpoint(endpointUrl) {
    this.apiEndpoint = endpointUrl;
  }

  /**
   * For test scenarios: allow testing UI handling of AI-generated warnings or uncertainty
   * @param {string|null} mode - null | 'LIKELY_REAL' | 'LIKELY_AI_GENERATED' | 'UNCERTAIN'
   */
  setTestMode(mode) {
    this._simulatedMode = mode;
  }

  /**
   * Verifies if an uploaded road photograph is a genuine camera capture or synthetic / AI-generated
   * @param {string} imageSource - DataURL, Blob URL, or remote URL
   * @returns {Promise<{status: string, statusLabel: string, confidence: number|null, message: string, isAcceptable: boolean, isSynthetic: boolean, isUncertain: boolean}>}
   */
  async verifyImage(imageSource) {
    // If a test mode was explicitly toggled for verification demonstration
    if (this._simulatedMode === AUTHENTICITY_STATUS.LIKELY_AI_GENERATED) {
      return {
        status: AUTHENTICITY_STATUS.LIKELY_AI_GENERATED,
        statusLabel: 'Likely AI-Generated',
        confidence: 0.94,
        message: 'This image appears to be AI-generated or synthetic. Please upload an original road photograph.',
        isAcceptable: false,
        isSynthetic: true,
        isUncertain: false
      };
    }

    if (this._simulatedMode === AUTHENTICITY_STATUS.UNCERTAIN) {
      return {
        status: AUTHENTICITY_STATUS.UNCERTAIN,
        statusLabel: 'Uncertain',
        confidence: 0.52,
        message: 'Image authenticity could not be confirmed with high confidence. Proceeding with caution according to municipal validation policy.',
        isAcceptable: this.validationPolicy.allowUncertain,
        isSynthetic: false,
        isUncertain: true
      };
    }

    if (this._simulatedMode === AUTHENTICITY_STATUS.LIKELY_REAL) {
      return {
        status: AUTHENTICITY_STATUS.LIKELY_REAL,
        statusLabel: 'Likely Real',
        confidence: 0.96,
        message: 'Verified real road photograph from optical sensor / mobile camera.',
        isAcceptable: true,
        isSynthetic: false,
        isUncertain: false
      };
    }

    // Live endpoint check (when Spring Boot / Python AI service is connected)
    if (this.apiEndpoint) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageSource })
        });
        if (response.ok) {
          const result = await response.json();
          return {
            status: result.status,
            statusLabel: result.status === AUTHENTICITY_STATUS.LIKELY_AI_GENERATED ? 'Likely AI-Generated' : (result.status === AUTHENTICITY_STATUS.LIKELY_REAL ? 'Likely Real' : 'Uncertain'),
            confidence: typeof result.confidence === 'number' ? result.confidence : null,
            message: result.message || 'Authenticity analyzed via backend detection model.',
            isAcceptable: result.status !== AUTHENTICITY_STATUS.LIKELY_AI_GENERATED,
            isSynthetic: result.status === AUTHENTICITY_STATUS.LIKELY_AI_GENERATED,
            isUncertain: result.status === AUTHENTICITY_STATUS.UNCERTAIN
          };
        }
      } catch (err) {
        console.warn('Image authenticity service endpoint unreachable:', err);
      }
    }

    // Default production state when external detector model is not yet connected:
    // Honest status reporting per SIH guidelines (no fabricated confidence!)
    return {
      status: AUTHENTICITY_STATUS.SERVICE_UNAVAILABLE,
      statusLabel: 'Image authenticity verification service unavailable',
      confidence: null,
      message: 'Authenticity detector endpoint is not currently connected. Backend model integration pending.',
      isAcceptable: true, // allows prototype flow to proceed to YOLO11 inspection
      isSynthetic: false,
      isUncertain: false
    };
  }
}

export const ImageAuthenticityService = new ImageAuthenticityServiceManager();
