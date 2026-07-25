import aj from "../config/arcjet.js";

const arcjectMiddleware = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested: 1 });

        if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
                return res.status(429).json({ message: 'Rate limit exceeded' });
            }
            if (decision.reason.isBot()) {
                return res.status(403).json({ message: 'Bot traffic is not allowed' });
            }

            return res.status(403).json({ message: 'Access denied' });
        }

        return next();
    } catch (error) {
        // Fail open on Arcjet outages so the API stays available
        console.error('ArcJet middleware error:', error);
        return next();
    }
};

export default arcjectMiddleware;
