import aj from "../config/arcjet.js";

const arcjectMiddleware = async (req, res, next) => {
    try {
        const decision = await aj.protect(req, { requested: 1 });

        if(decision.isDenied()){
            if(decision.reason.isRateLimit()) return res.status(429).json({ message: 'Rate limit exceeded' });
            if(decision.reason.isBot()) return res.status(403).json({ message: 'Bot traffic is not allowed' });

            return res.status(403).json({ message: 'Access denied' });
        }

        next();
    } catch (error) {
        console.error('ArcJet middleware error:', error);
        res.status(500).json({ message: 'Internal server error' });
        next(error); // Pass the error to the next middleware
    }
};

export default arcjectMiddleware;