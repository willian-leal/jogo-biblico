import { Injectable } from '@angular/core';
import QRCode from 'qrcode';

export type MultiRoomMode = 'forca' | 'equipes';

@Injectable({ providedIn: 'root' })
export class RoomShareService {
  buildJoinUrl(mode: MultiRoomMode, codigoSala: string, role: 'entrar' | 'assistir' = 'entrar'): string {
    const path = mode === 'forca' ? '/forca/multi' : '/equipes/multi';
    const url = new URL(path, window.location.origin);
    url.searchParams.set('sala', codigoSala);
    url.searchParams.set('modo', role);
    return url.toString();
  }

  async buildQrCode(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: '#101827',
        light: '#ffffff'
      }
    });
  }

  async copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
