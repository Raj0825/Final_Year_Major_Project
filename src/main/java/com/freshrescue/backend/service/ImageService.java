package com.freshrescue.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageService {

    private final GridFsTemplate gridFsTemplate;

    public String storeImage(byte[] imageBytes, String filename) {
        if (imageBytes == null || imageBytes.length == 0) {
            return null;
        }

        byte[] processedBytes = resizeToMax1024Jpeg(imageBytes);

        String storeFilename = (filename != null && !filename.isBlank()) ? filename : "image.jpg";
        if (!storeFilename.toLowerCase().endsWith(".jpg") && !storeFilename.toLowerCase().endsWith(".jpeg")) {
            storeFilename += ".jpg";
        }

        ObjectId id = gridFsTemplate.store(
                new ByteArrayInputStream(processedBytes),
                storeFilename,
                "image/jpeg"
        );
        return id.toHexString();
    }

    public GridFsResource getImage(String id) {
        if (id == null || id.isBlank()) return null;
        try {
            var file = gridFsTemplate.findOne(Query.query(Criteria.where("_id").is(new ObjectId(id))));
            if (file == null) return null;
            return gridFsTemplate.getResource(file);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public byte[] resizeToMax1024Jpeg(byte[] originalBytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(originalBytes));
            if (img == null) {
                return originalBytes;
            }

            int width = img.getWidth();
            int height = img.getHeight();

            int targetWidth = width;
            int targetHeight = height;

            if (width > 1024 || height > 1024) {
                if (width >= height) {
                    targetWidth = 1024;
                    targetHeight = (int) Math.round((double) height * 1024.0 / width);
                } else {
                    targetHeight = 1024;
                    targetWidth = (int) Math.round((double) width * 1024.0 / height);
                }
            }

            BufferedImage resized = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = resized.createGraphics();
            g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.drawImage(img, 0, 0, targetWidth, targetHeight, Color.WHITE, null);
            g2d.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(resized, "jpg", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            log.warn("Could not resize image, storing original bytes: {}", e.getMessage());
            return originalBytes;
        }
    }
}
