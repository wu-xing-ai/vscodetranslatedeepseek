"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
/**
 * LRU (Least Recently Used) cache with O(1) get/set operations.
 * Uses JavaScript's Map insertion-order guarantee to track recency
 * — the first key in iteration order is the least recently used.
 */
class LRUCache {
    capacity;
    map = new Map();
    constructor(capacity) {
        this.capacity = capacity;
    }
    /**
     * Retrieve a value by key, moving it to the most-recently-used position.
     * Returns undefined on cache miss.
     */
    get(key) {
        const value = this.map.get(key);
        if (value === undefined) {
            return undefined;
        }
        // Move to MRU: delete then re-insert (Map preserves insertion order)
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }
    /**
     * Insert or update a key-value pair.
     * If the cache is at capacity, evicts the least recently used entry first.
     */
    set(key, value) {
        // If key already exists, delete it first (will be re-inserted at MRU position)
        if (this.map.has(key)) {
            this.map.delete(key);
        }
        else if (this.map.size >= this.capacity) {
            // Evict the LRU entry — the first key returned by keys() iterator
            const lruKey = this.map.keys().next().value;
            if (lruKey !== undefined) {
                this.map.delete(lruKey);
            }
        }
        this.map.set(key, value);
    }
    /** Check if a key exists in the cache without affecting recency order. */
    has(key) {
        return this.map.has(key);
    }
    /** Remove all entries from the cache. */
    clear() {
        this.map.clear();
    }
    /** Adjust capacity at runtime. Evicts LRU entries if the new capacity is smaller. */
    updateCapacity(newCapacity) {
        this.capacity = newCapacity;
        while (this.map.size > this.capacity) {
            const lruKey = this.map.keys().next().value;
            if (lruKey !== undefined) {
                this.map.delete(lruKey);
            }
        }
    }
    /** Return the current number of cached entries. */
    get size() {
        return this.map.size;
    }
}
exports.LRUCache = LRUCache;
//# sourceMappingURL=cache.js.map