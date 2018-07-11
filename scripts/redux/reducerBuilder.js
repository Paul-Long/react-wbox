import { combineReducers } from 'redux';
import invariant from 'invariant';
import { isArray, isFunction } from './utils';

type Opts = {
  models: Array,
  onReducer: Function
}
export default function (opts: Opts) {
  const {models, onReducer} = opts;
  const groups = new Map();
  for (const model of models) {
    invariant(
      isArray(model),
      `model should be Array`,
    );
    collect(groups, model);
  }
  const reducers = {};
  for (const [key, reducerGroup] of groups.entries()) {
    reducers[key] = initial(reducerGroup, onReducer);
  }
  return combineReducers(reducers);
}

function collect(groups, reducers) {
  for (let index = 0; index < reducers.length; index += 1) {
    const reducer = reducers[index];
    const keys = reducer.namespace.split('.');
    const [groupKey, ...subKeys] = keys;
    let group = groups.get(groupKey);
    if (!group) {
      group = new Map();
      groups.set(groupKey, group);
    }
    if (subKeys.length === 0) {
      reducer.single = true;
    } else {
      reducer.subKeys = subKeys;
    }
    invariant(
      !(group.has(reducer.namespace) && !reducer.single),
      `Duplicate namespace ${reducer.namespace}`,
    );
    group.set(reducer.namespace, reducer);
  }
}

function initial(group, onReducer) {
  const handlers = {};
  let initialState = {};
  for (const model of group.values()) {
    const {namespace, state, subKeys, single, reducer} = model;
    const value = (typeof state === 'undefined' || state === null) ? {} : state;
    if (single) {
      initialState = value;
    } else {
      overrideState(initialState, subKeys, value);
    }
    if (isFunction(reducer)) {
      handlers[namespace] = reducerHandler(model, reducer, onReducer);
    } else {
      for (const key in reducer) {
        if (Object.prototype.hasOwnProperty.call(reducer, key)) {
          handlers[`${namespace}.${key}`] = reducerHandler(model, reducer[key], onReducer);
        }
      }
    }
  }
  return createReducer(initialState, handlers);
}

function overrideState(state, keys, value = {}) {
  let previous = state;
  for (let i = 0; i < keys.length; i += 1) {
    let next = previous[keys[i]];
    if (i === keys.length - 1) {
      previous[keys[i]] = value;
    } else {
      if (!next) {
        previous[keys[i]] = {};
        next = previous[keys[i]];
      }
      previous = next;
    }
  }
}

function createReducer(initialState, handlers) {
  invariant(
    !(typeof initialState === 'undefined' || initialState === null),
    'Initial state is required',
  );
  return (state = initialState, action) => {
    if (!action || !action.type) {
      return state;
    }
    const handler = handlers[action.type];
    return handler ? handler(state, action) : state;
  };
}

function reducerHandler(model, handler, onReducer) {
  return (state, action) => {
    if (typeof onReducer === 'function') {
      state = onReducer(state, action) || state;
    }
    if (model.single) {
      state = handler(state, action);
    } else {
      overrideState(state, model.subKeys, handler(state, action));
    }
    return state;
  };
}
