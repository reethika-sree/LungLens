#!/usr/bin/env python3
"""
Simple training script for chest X-ray model using synthetic data approach
"""

import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
import torchvision.transforms as transforms
import numpy as np
from PIL import Image
import random

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from chest_xray.model import ChestXrayModel

class SimpleXRayTrainer:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {self.device}")
        
        # Use the correct model structure
        self.model = ChestXrayModel(pretrained=True, num_classes=1)
        self.model = self.model.to(self.device)
        self.criterion = nn.BCEWithLogitsLoss()
        self.optimizer = optim.Adam(self.model.parameters(), lr=0.001)
    
    def generate_synthetic_batch(self, batch_size=8):
        """Generate synthetic X-ray-like images"""
        # Create random grayscale images that resemble X-rays
        images = torch.randn(batch_size, 1, 224, 224) * 0.3 + 0.7
        
        # Add some X-ray-like patterns
        for i in range(batch_size):
            # Add lung-like structures
            lung_mask = torch.zeros(1, 224, 224)
            lung_mask[:, 50:180, 60:100] = 1  # Left lung
            lung_mask[:, 50:180, 124:164] = 1  # Right lung
            
            # Add some texture
            noise = torch.randn(1, 224, 224) * 0.1
            images[i] = images[i] + lung_mask * 0.2 + noise
        
        # Convert to 3-channel RGB
        images = images.repeat(1, 3, 1, 1)
        images = torch.clamp(images, 0, 1)
        
        # Generate labels (0: Normal, 1: TB)
        labels = torch.randint(0, 2, (batch_size, 1)).float()
        
        return images.to(self.device), labels.to(self.device)
    
    def train(self, num_epochs=10):
        print("Training chest X-ray model with synthetic data...")
        
        self.model.train()
        for epoch in range(num_epochs):
            running_loss = 0.0
            
            # Generate multiple batches per epoch
            for batch in range(20):  # 20 batches per epoch
                images, labels = self.generate_synthetic_batch(batch_size=4)
                
                # Zero the parameter gradients
                self.optimizer.zero_grad()
                
                # Forward pass
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                # Backward pass and optimize
                loss.backward()
                self.optimizer.step()
                
                running_loss += loss.item()
            
            epoch_loss = running_loss / 20
            print(f"Epoch [{epoch+1}/{num_epochs}], Loss: {epoch_loss:.4f}")
        
        print("Training completed!")
    
    def save_model(self, path):
        """Save the trained model in the correct format"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # Save the full model state dict
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'model_config': {
                'pretrained': True,
                'num_classes': 1
            }
        }, path)
        print(f"Model saved to {path}")
    
    def predict(self, image_tensor):
        """Make prediction on a single image"""
        self.model.eval()
        with torch.no_grad():
            if image_tensor.dim() == 3:
                image_tensor = image_tensor.unsqueeze(0)
            image_tensor = image_tensor.to(self.device)
            output = self.model(image_tensor)
            probability = torch.sigmoid(output).item()
        return probability

def main():
    print("Initializing chest X-ray model...")
    trainer = SimpleXRayTrainer()
    
    # Train the model
    trainer.train(num_epochs=5)
    
    # Save the model
    save_path = "chest_xray/weights/densenet121_tb.pth"
    trainer.save_model(save_path)
    
    # Test with a synthetic image
    print("\nTesting with synthetic X-ray image...")
    test_image, _ = trainer.generate_synthetic_batch(batch_size=1)
    probability = trainer.predict(test_image)
    print(f"Sample prediction TB probability: {probability:.3f}")

if __name__ == "__main__":
    main()
