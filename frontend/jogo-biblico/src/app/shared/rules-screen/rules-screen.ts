import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GameRule {
  icon: string;
  text: string;
}

@Component({
  selector: 'app-rules-screen',
  imports: [CommonModule],
  templateUrl: './rules-screen.html',
  styleUrl: './rules-screen.scss'
})
export class RulesScreen {
  @Input() title = '';
  @Input() rules: GameRule[] = [];
  @Output() ready = new EventEmitter<void>();
}
