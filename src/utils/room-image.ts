const roomImageUrl = (image?: string | null): string => {
    if (!image) {
        return '/client/img/room-1.jpg';
    }

    const filename = image.replace(/\\/g, '/').split('/').pop();
    return filename ? `/images/product/${filename}` : '/client/img/room-1.jpg';
};

export default roomImageUrl;