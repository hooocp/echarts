/**
 * K-Dimension Tree
 *
 * @module echarts/data/KDTree
 * @author Yi Shen(https://github.com/pissang)
 */
define(function (require) {

    var quickSelect = require('./quickSelect');

    function Node(axis, data) {
        this.left = null;
        this.right = null;
        this.axis = axis;

        this.data = data;
    };

    /**
     * @constructor
     * @alias module:echarts/data/KDTree
     * @param {Array} points List of points
     * @param {Number} [dimension]
     *        Point dimension.
     *        Default will use the first point's length as dimensiont
     */
    var KDTree = function (points, dimension) {
        if (!dimension && points.length > 0) {
            dimension = points[0].length;
        }
        this.dimension = dimension;
        this.root = this._buildTree(points, 0, points.length - 1, 0);

        // Use one stack to avoid allocation 
        // each time searching the nearest point
        this._stack = [];
        // Again avoid allocating a new array
        // each time searching nearest N points
        this._nearstNList = [];
    };

    /**
     * Resursively build the tree
     */
    KDTree.prototype._buildTree = function (points, left, right, axis) {
        var medianIndex = Math.floor((left + right) / 2);
        medianIndex = quickSelect(
            points, left, right, medianIndex,
            function (a, b) {
                return a[axis] - b[axis];
            }
        );
        var median = points[medianIndex];

        var node = new Node(axis, median);

        axis = (axis + 1) % this.dimension;
        if (right > left) {
            node.left = this._buildTree(points, left, medianIndex, axis);
            node.right = this._buildTree(points, medianIndex + 1, right, axis);   
        }

        return node;
    };

    /**
     * Find nearest point
     * @param  {Array} target Target point
     * @param  {Function} squaredDistance Squared distance function
     * @return {Array} Nearest point
     */
    KDTree.prototype.nearest = function (target, squaredDistance) {
        var curr = this.root;
        var stack = this._stack;
        var idx = 0;
        var minDist = squaredDistance(curr.data, target);
        var nearestNode = curr;

        if (target[curr.axis] < curr.data[curr.axis]) {
            // Left first
            curr.right && (stack[idx++] = curr.right);
            curr.left && (stack[idx++] = curr.left);
        }
        else {
            // Right first
            curr.left && (stack[idx++] = curr.left);
            curr.right && (stack[idx++] = curr.right);
        }

        while (idx--) {
            curr = stack[idx];
            var currDist = target[curr.axis] - curr.data[curr.axis];
            var isLeft = currDist < 0;
            var needsCheckOtherSide = false;
            currDist = currDist * currDist;
            // Intersecting right hyperplane with minDist hypersphere
            if (currDist < minDist) {
                currDist = squaredDistance(curr.data, target);
                if (currDist < minDist) {
                    minDist = currDist;
                    nearestNode = curr;
                }
                needsCheckOtherSide = true;
            }
            if (isLeft) {
                if (needsCheckOtherSide) {
                    curr.right && (stack[idx++] = curr.right);
                }
                // Search in the left area
                curr.left && (stack[idx++] = curr.left);
            }
            else {
                if (needsCheckOtherSide) {
                    curr.left && (stack[idx++] = curr.left);
                }
                // Search the right area
                curr.right && (stack[idx++] = curr.right);
            }
        }

        return nearestNode.data;
    };

    KDTree.prototype._addNearest = function (found, dist, node) {
        var nearestNList = this._nearstNList;

        // Insert to the right position
        // Sort from small to large
        for (var i = found - 1; i > 0; i--) {
            if (dist >= nearestNList[i - 1].dist) {                
                break;
            }
            else {
                nearestNList[i].dist = nearestNList[i - 1].dist;
                nearestNList[i].node = nearestNList[i - 1].node;
            }
        }

        nearestNList[i].dist = dist;
        nearestNList[i].node = node;
    };

    /**
     * Find nearest N points
     * @param  {Array} target Target point
     * @param  {number} N
     * @param  {Function} squaredDistance Squared distance function
     * @param  {Array} [output] Output nearest N points
     */
    KDTree.prototype.nearestN = function (target, N, squaredDistance, output) {
        if (N <= 0) {
            output.length = 0;
            return output;
        }

        var curr = this.root;
        var stack = this._stack;
        var idx = 0;

        var nearestNList = this._nearstNList;
        for (var i = 0; i < N; i++) {
            // Allocate
            if (!nearestNList[i]) {
                nearestNList[i] = {}
            }
            nearestNList[i].dist = 0;
            nearestNList[i].node = null;
        }
        var currDist = squaredDistance(curr.data, target);

        var found = 1;
        this._addNearest(found, currDist, curr);

        if (target[curr.axis] < curr.data[curr.axis]) {
            // Left first
            curr.right && (stack[idx++] = curr.right);
            curr.left && (stack[idx++] = curr.left);
        }
        else {
            // Right first
            curr.left && (stack[idx++] = curr.left);
            curr.right && (stack[idx++] = curr.right);
        }

        while (idx--) {
            curr = stack[idx];
            var currDist = target[curr.axis] - curr.data[curr.axis];
            var isLeft = currDist < 0;
            var needsCheckOtherSide = false;
            currDist = currDist * currDist;
            // Intersecting right hyperplane with minDist hypersphere
            var maxInMinDist = nearestNList[found - 1].dist;
            if (found < N || currDist < maxInMinDist) {
                currDist = squaredDistance(curr.data, target);
                if (found < N || currDist < maxInMinDist) {
                    if (found < N) {
                        found++;
                    }
                    this._addNearest(found, currDist, curr);
                }
                needsCheckOtherSide = true;
            }
            if (isLeft) {
                if (needsCheckOtherSide) {
                    curr.right && (stack[idx++] = curr.right);
                }
                // Search in the left area
                curr.left && (stack[idx++] = curr.left);
            }
            else {
                if (needsCheckOtherSide) {
                    curr.left && (stack[idx++] = curr.left);
                }
                // Search the right area
                curr.right && (stack[idx++] = curr.right);
            }
        }

        // Copy to output
        for (var i = 0; i < found; i++) {
            output[i] = nearestNList[i].node.data;
        }
        output.length = found;

        return output;
    }

    return KDTree;
});