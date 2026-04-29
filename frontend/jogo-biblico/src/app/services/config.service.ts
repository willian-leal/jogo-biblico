import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  apiUrl = 'http://localhost:5000';

  load(): Promise<void> {
    return fetch('/config.json')
      .then(r => r.json())
      .then((cfg: { apiUrl: string }) => { this.apiUrl = cfg.apiUrl; })
      .catch(() => {});
  }
}
