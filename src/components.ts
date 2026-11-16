/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Robot } from './robot-component.js';
import { createComponent, defineComponents, Types } from '@iwsdk/core';

export const StateOrb = createComponent('StateOrb', {
    mode: { type: Types.String, default: 'calm' }, });

export const TaskBlock = createComponent('TaskBlock', {
    title: { type: Types.String, default: 'Write Pitch Outline'},
    stepIndex: { type: Types.Int32, default: 0 },
    splitLevel: { type: Types.Int32, default: 0 },
    completed: { type: Types.Boolean, default: false },
});

export const SplitTrigger = createComponent('SplitTrigger', {
    parentBlockId: { type: Types.Int32, default: -1 },
});

export const ThoughtBubble = createComponent('ThoughtBubble', {
    label: {type: Types.String, default: 'Intrusive thought'},
    parked: {type: Types.Boolean, default: false},
});

export const ActionButton = createComponent('ActionButton', {
    action: { type: Types.String, default: ''},
    payload: { type: Types.String, default: ''},
});

export default defineComponents([
    Robot,
    StateOrb,
    TaskBlock,
    SplitTrigger,
    ThoughtBubble,
    ActionButton,
]);
